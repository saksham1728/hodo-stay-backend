const { Building, Unit } = require('../models');
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

class BuildingController {
  // Get all buildings
  async getBuildings(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      
      console.log('Fetching all buildings');
      
      const query = { isActive: true };
      const skip = (page - 1) * limit;
      
      // Get buildings with unit counts
      const buildings = await Building.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'units',
            localField: '_id',
            foreignField: 'buildingId',
            as: 'units'
          }
        },
        {
          $addFields: {
            totalUnits: { $size: '$units' },
            availableUnits: {
              $size: {
                $filter: {
                  input: '$units',
                  cond: { $and: [{ $eq: ['$$this.isActive', true] }, { $eq: ['$$this.isArchived', false] }] }
                }
              }
            }
          }
        },
        { $project: { units: 0 } }, // Don't send all unit data
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) }
      ]);
      
      const totalBuildings = await Building.countDocuments(query);
      
      res.json({
        success: true,
        data: {
          buildings,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalBuildings / limit),
            totalBuildings,
            hasNext: page * limit < totalBuildings,
            hasPrev: page > 1
          }
        }
      });
      
    } catch (error) {
      console.error('Error in getBuildings:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get building details with all its units
  async getBuildingDetails(req, res) {
    try {
      const { buildingId } = req.params;
      
      console.log(`Fetching building details for: ${buildingId}`);
      
      // Get building
      const building = await Building.findById(buildingId).lean();
      
      if (!building) {
        return res.status(404).json({
          success: false,
          message: 'Building not found'
        });
      }
      
      // Get all units in this building
      const units = await Unit.find({
        buildingId: buildingId,
        isActive: true,
        isArchived: false
      }).lean();
      
      res.json({
        success: true,
        data: {
          building: {
            ...building,
            units: units
          }
        }
      });
      
    } catch (error) {
      console.error('Error in getBuildingDetails:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Create a new building
  async createBuilding(req, res) {
    try {
      const buildingData = req.body;
      
      console.log('Creating new building:', buildingData.name);
      
      const building = new Building(buildingData);
      await building.save();
      
      res.status(201).json({
        success: true,
        message: 'Building created successfully',
        data: { building }
      });
      
    } catch (error) {
      console.error('Error creating building:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create building',
        error: error.message
      });
    }
  }

  // Sync units from RU API for a specific building
  async syncUnitsForBuilding(req, res) {
    try {
      const { buildingId } = req.params;
      const { locationId = 41982 } = req.body;
      
      console.log(`Syncing units for building ${buildingId} from location ${locationId}`);
      
      // Verify building exists
      const building = await Building.findById(buildingId);
      if (!building) {
        return res.status(404).json({
          success: false,
          message: 'Building not found'
        });
      }
      
      // Step 1: Get list of properties in location
      const listXml = await ruClient.pullListProp(locationId, false);
      const listResponse = xmlParser.parse(listXml);
      
      if (listResponse.error) {
        throw new Error(`API Error: ${listResponse.error}`);
      }
      
      const apiProperties = listResponse?.Pull_ListProp_RS?.Properties?.Property || [];
      const propertiesArray = Array.isArray(apiProperties) ? apiProperties : [apiProperties];
      
      console.log(`Found ${propertiesArray.length} properties from RU API`);
      
      let savedCount = 0;
      
      // Step 2: Get detailed info for each property and save
      for (const apiProperty of propertiesArray) {
        const propertyId = parseInt(apiProperty.ID);
        
        try {
          // Get detailed property info
          const detailXml = await ruClient.pullListSpecProp(propertyId);
          const detailResponse = xmlParser.parse(detailXml);
          const propertyDetail = detailResponse?.Pull_ListSpecProp_RS?.Property;
          
          if (!propertyDetail) {
            console.log(`Skipping property ${propertyId} - no details found`);
            continue;
          }
          
          const unitData = {
            ruPropertyId: propertyId,
            ruOwnerID: parseInt(apiProperty.OwnerID) || 0,
            buildingId: buildingId,
            name: propertyDetail.Name || apiProperty.Name || `Unit ${propertyId}`,
            description: propertyDetail.Description || '',
            space: parseFloat(propertyDetail.Space) || 0,
            standardGuests: parseInt(propertyDetail.StandardGuests) || 1,
            canSleepMax: parseInt(propertyDetail.CanSleepMax) || 1,
            noOfUnits: parseInt(propertyDetail.NoOfUnits) || 1,
            floor: parseInt(propertyDetail.Floor) || 0,
            propertyType: {
              propertyTypeID: parseInt(propertyDetail.PropertyTypeID) || 0,
              objectTypeID: parseInt(propertyDetail.ObjectTypeID) || 0
            },
            pricing: {
              deposit: parseFloat(propertyDetail.Deposit) || 0,
              securityDeposit: parseFloat(propertyDetail.SecurityDeposit) || 0
            },
            checkInOut: {
              checkInFrom: propertyDetail.CheckInFrom || '',
              checkInTo: propertyDetail.CheckInTo || '',
              checkOutUntil: propertyDetail.CheckOutUntil || '',
              place: propertyDetail.CheckInOutPlace || ''
            },
            images: [],
            amenities: [],
            compositionRooms: [],
            lastSyncedAt: new Date(),
            ruLastMod: apiProperty.LastMod ? new Date(apiProperty.LastMod) : new Date()
          };
          
          // Parse images if available
          if (propertyDetail.Images?.Image) {
            const images = Array.isArray(propertyDetail.Images.Image) 
              ? propertyDetail.Images.Image 
              : [propertyDetail.Images.Image];
            
            unitData.images = images.map((img, index) => ({
              imageTypeID: parseInt(img['@_ImageTypeID']) || 0,
              imageReferenceID: parseInt(img['@_ImageReferenceID']) || 0,
              url: typeof img === 'string' ? img : (img['#text'] || img),
              isPrimary: index === 0
            }));
          }
          
          // Parse amenities if available
          if (propertyDetail.Amenities?.Amenity) {
            const amenities = Array.isArray(propertyDetail.Amenities.Amenity)
              ? propertyDetail.Amenities.Amenity
              : [propertyDetail.Amenities.Amenity];
            
            unitData.amenities = amenities.map(amenity => ({
              amenityID: parseInt(amenity['@_ID']) || 0,
              count: parseInt(amenity['@_Count']) || 1
            }));
          }
          
          // Parse composition rooms if available
          if (propertyDetail.CompositionRooms?.CompositionRoom) {
            const rooms = Array.isArray(propertyDetail.CompositionRooms.CompositionRoom)
              ? propertyDetail.CompositionRooms.CompositionRoom
              : [propertyDetail.CompositionRooms.CompositionRoom];
            
            unitData.compositionRooms = rooms.map(room => ({
              compositionRoomID: parseInt(room['@_ID']) || 0,
              count: parseInt(room['@_Count']) || 1
            }));
          }
          
          // Upsert unit
          await Unit.findOneAndUpdate(
            { ruPropertyId: unitData.ruPropertyId },
            unitData,
            { upsert: true, new: true }
          );
          
          savedCount++;
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.log(`Error fetching property ${propertyId}:`, error.message);
        }
      }
      
      // Update building's total units count
      const totalUnits = await Unit.countDocuments({ buildingId, isActive: true, isArchived: false });
      await Building.findByIdAndUpdate(buildingId, { totalUnits });
      
      console.log(`✅ Synced ${savedCount} units for building ${building.name}`);
      
      res.json({
        success: true,
        message: `Successfully synced ${savedCount} units`,
        data: {
          buildingId,
          buildingName: building.name,
          unitsSynced: savedCount,
          totalUnits
        }
      });
      
    } catch (error) {
      console.error('Error syncing units:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to sync units',
        error: error.message
      });
    }
  }
}

const buildingController = new BuildingController();
module.exports = buildingController;
