const { Building, Unit } = require('../models');
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

class BuildingController {
  // Get all buildings (property groups) with unit counts
  async getBuildings(req, res) {
    try {
      const { locationId = 41982, page = 1, limit = 10 } = req.query;
      
      console.log(`Fetching buildings for location: ${locationId}`);
      
      // Build query
      const query = {
        'location.detailedLocationID': parseInt(locationId),
        isActive: true
      };
      
      // Pagination
      const skip = (page - 1) * limit;
      
      // Get buildings with unit counts
      const buildings = await Building.aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'units',
            localField: 'buildingId',
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
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) }
      ]);
      
      const totalBuildings = await Building.countDocuments(query);
      
      // Check if we need to sync (no buildings found OR data is stale)
      const needsSync = buildings.length === 0 || buildingController.isDataStale(buildings[0]?.lastSyncedAt, 10); // 10 minutes
      
      if (needsSync) {
        console.log(buildings.length === 0 ? 'No buildings found, attempting sync...' : 'Data is stale, refreshing from API...');
        await buildingController.syncFromAPI(locationId);
        
        // Re-query after sync
        const syncedBuildings = await Building.aggregate([
          { $match: query },
          {
            $lookup: {
              from: 'units',
              localField: 'buildingId',
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
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: parseInt(limit) }
        ]);
        
        return res.json({
          success: true,
          data: {
            buildings: syncedBuildings,
            pagination: {
              currentPage: parseInt(page),
              totalPages: Math.ceil(syncedBuildings.length / limit),
              totalBuildings: syncedBuildings.length,
              hasNext: false,
              hasPrev: false
            },
            locationId: locationId
          }
        });
      }
      
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
          },
          locationId: locationId
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
      const building = await Building.findOne({ buildingId }).lean();
      
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

  // Sync buildings and units from Rentals United API
  async syncFromAPI(locationId = 41982) {
    try {
      console.log(`Starting sync for location: ${locationId}`);
      
      // Get property list from Rentals United
      const xmlResponse = await ruClient.pullListProp(locationId, false);
      const parsedResponse = xmlParser.parse(xmlResponse);
      
      if (parsedResponse.error) {
        throw new Error(`API Error: ${parsedResponse.error}`);
      }
      
      const apiProperties = parsedResponse?.Pull_ListProp_RS?.Properties?.Property || [];
      const propertiesArray = Array.isArray(apiProperties) ? apiProperties : [apiProperties];
      
      console.log(`Found ${propertiesArray.length} units from API`);
      
      // Group properties by building (using PUID or location)
      const buildingGroups = {};
      
      for (const apiProperty of propertiesArray) {
        const buildingKey = apiProperty.PUID || `location_${apiProperty.DetailedLocationID}`;
        
        if (!buildingGroups[buildingKey]) {
          buildingGroups[buildingKey] = {
            buildingId: buildingKey,
            name: `Property Group ${buildingKey}`,
            location: {
              detailedLocationID: parseInt(apiProperty.DetailedLocationID)
            },
            units: []
          };
        }
        
        buildingGroups[buildingKey].units.push(apiProperty);
      }
      
      // Save buildings and units
      for (const [buildingKey, buildingData] of Object.entries(buildingGroups)) {
        // Create or update building
        await Building.findOneAndUpdate(
          { buildingId: buildingKey },
          {
            buildingId: buildingKey,
            name: buildingData.name,
            location: buildingData.location,
            totalUnits: buildingData.units.length,
            lastSyncedAt: new Date()
          },
          { upsert: true, new: true }
        );
        
        // Create or update units
        for (const apiUnit of buildingData.units) {
          await Unit.findOneAndUpdate(
            { ruPropertyId: apiUnit.ID },
            {
              ruPropertyId: apiUnit.ID,
              ruOwnerID: apiUnit.OwnerID,
              buildingId: buildingKey,
              name: apiUnit.Name,
              lastSyncedAt: new Date(),
              ruLastMod: new Date(apiUnit.LastMod)
            },
            { upsert: true, new: true }
          );
        }
      }
      
      console.log(`✅ Sync completed: ${Object.keys(buildingGroups).length} buildings, ${propertiesArray.length} units`);
      
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  // Helper method to check if data is stale
  isDataStale(lastSyncedAt, maxAgeMinutes = 10) {
    if (!lastSyncedAt) return true;
    
    const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds
    return (Date.now() - new Date(lastSyncedAt).getTime()) > maxAge;
  }
}

const buildingController = new BuildingController();
module.exports = buildingController;