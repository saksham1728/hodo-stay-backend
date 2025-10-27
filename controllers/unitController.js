const { Unit } = require('../models');
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

class UnitController {
  // Get unit details with full information from API
  async getUnitDetails(req, res) {
    try {
      const { unitId } = req.params;
      
      console.log(`Fetching unit details for: ${unitId}`);
      
      // Find unit by MongoDB ID or RU Property ID
      let query = {};
      if (unitId.match(/^[0-9a-fA-F]{24}$/)) {
        query = { $or: [{ _id: unitId }, { ruPropertyId: parseInt(unitId) }] };
      } else {
        query = { ruPropertyId: parseInt(unitId) };
      }
      
      let unit = await Unit.findOne(query).lean();
      
      if (!unit) {
        return res.status(404).json({
          success: false,
          message: 'Unit not found'
        });
      }
      
      // Check if we need to fetch fresh data (data is stale or missing details)
      const needsFreshData = unitController.isDataStale(unit.lastSyncedAt, 10) || !unit.description || !unit.images?.length;
      
      if (needsFreshData) {
        // Get detailed info from Rentals United API
        try {
          console.log(`Fetching fresh detailed info from API for unit: ${unit.ruPropertyId}`);
          
          const xmlResponse = await ruClient.pullListSpecProp(unit.ruPropertyId, 'USD');
        const parsedResponse = xmlParser.parse(xmlResponse);
        
        if (parsedResponse.error) {
          console.log('API error, returning cached data');
        } else {
          const apiUnit = parsedResponse?.Pull_ListSpecProp_RS?.Property;
          
          if (apiUnit) {
            // Update unit with detailed information
            const updatedUnit = await Unit.findOneAndUpdate(
              { ruPropertyId: unit.ruPropertyId },
              {
                name: apiUnit.Name,
                description: apiUnit.Descriptions?.Description?.Text || '',
                space: parseInt(apiUnit.Space) || 0,
                standardGuests: parseInt(apiUnit.StandardGuests) || 1,
                canSleepMax: parseInt(apiUnit.CanSleepMax) || 1,
                noOfUnits: parseInt(apiUnit.NoOfUnits) || 1,
                floor: parseInt(apiUnit.Floor) || 0,
                
                propertyType: {
                  propertyTypeID: parseInt(apiUnit.PropertyTypeID),
                  objectTypeID: parseInt(apiUnit.ObjectTypeID)
                },
                
                pricing: {
                  deposit: parseFloat(apiUnit.Deposit) || 0,
                  securityDeposit: parseFloat(apiUnit.SecurityDeposit) || 0
                },
                
                checkInOut: {
                  checkInFrom: apiUnit.CheckInOut?.CheckInFrom,
                  checkInTo: apiUnit.CheckInOut?.CheckInTo,
                  checkOutUntil: apiUnit.CheckInOut?.CheckOutUntil,
                  place: apiUnit.CheckInOut?.Place
                },
                
                images: unitController.parseImages(apiUnit.Images?.Image),
                amenities: unitController.parseAmenities(apiUnit.Amenities?.Amenity),
                compositionRooms: unitController.parseCompositionRooms(apiUnit.CompositionRooms?.CompositionRoomID),
                
                lastSyncedAt: new Date(),
                ruLastMod: new Date(apiUnit.LastMod)
              },
              { new: true, lean: true }
            );
            
            unit = updatedUnit;
          }
        }
        } catch (apiError) {
          console.error('API error, using cached data:', apiError.message);
        }
      } else {
        console.log(`Using cached data for unit: ${unit.ruPropertyId} (last synced: ${new Date(unit.lastSyncedAt).toLocaleString()})`);
      }
      
      res.json({
        success: true,
        data: {
          unit
        }
      });
      
    } catch (error) {
      console.error('Error in getUnitDetails:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get unit availability and pricing for specific dates
  async getUnitAvailabilityPrice(req, res) {
    try {
      const { unitId } = req.params;
      const { dateFrom, dateTo, guests, currency = 'USD' } = req.query;
      
      if (!dateFrom || !dateTo) {
        return res.status(400).json({
          success: false,
          message: 'dateFrom and dateTo are required'
        });
      }
      
      console.log(`Getting availability and price for unit: ${unitId}, dates: ${dateFrom} to ${dateTo}`);
      
      // Find unit
      let query = {};
      if (unitId.match(/^[0-9a-fA-F]{24}$/)) {
        query = { $or: [{ _id: unitId }, { ruPropertyId: parseInt(unitId) }] };
      } else {
        query = { ruPropertyId: parseInt(unitId) };
      }
      
      const unit = await Unit.findOne(query).lean();
      
      if (!unit) {
        return res.status(404).json({
          success: false,
          message: 'Unit not found'
        });
      }
      
      // Get availability and pricing from Rentals United API
      try {
        const xmlResponse = await ruClient.pullGetPropertyAvbPrice(
          unit.ruPropertyId, 
          dateFrom, 
          dateTo, 
          guests, 
          currency
        );
        const parsedResponse = xmlParser.parse(xmlResponse);
        
        if (parsedResponse.error) {
          return res.status(400).json({
            success: false,
            error: parsedResponse.error,
            message: 'Error fetching availability from Rentals United'
          });
        }
        
        const priceData = parsedResponse?.Pull_GetPropertyAvbPrice_RS?.PropertyPrices;
        
        if (!priceData) {
          return res.status(404).json({
            success: false,
            message: 'No availability or pricing found for the selected dates'
          });
        }
        
        res.json({
          success: true,
          data: {
            unit: {
              id: unit._id,
              name: unit.name,
              ruPropertyId: unit.ruPropertyId
            },
            availability: {
              dateFrom,
              dateTo,
              guests: guests || unit.standardGuests,
              currency,
              pricing: priceData,
              isAvailable: true
            }
          }
        });
        
      } catch (apiError) {
        console.error('Error fetching availability:', apiError);
        res.status(500).json({
          success: false,
          message: 'Failed to fetch availability',
          error: apiError.message
        });
      }
      
    } catch (error) {
      console.error('Error in getUnitAvailabilityPrice:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Helper method to parse images
  parseImages(apiImages) {
    if (!apiImages) return [];
    
    const imagesArray = Array.isArray(apiImages) ? apiImages : [apiImages];
    
    return imagesArray.map((img, index) => ({
      imageTypeID: img['@_ImageTypeID'] || 1,
      imageReferenceID: img['@_ImageReferenceID'] || index + 1,
      url: img['#text'] || img,
      isPrimary: index === 0
    }));
  }

  // Helper method to parse amenities
  parseAmenities(apiAmenities) {
    if (!apiAmenities) return [];
    
    const amenitiesArray = Array.isArray(apiAmenities) ? apiAmenities : [apiAmenities];
    
    return amenitiesArray.map(amenity => ({
      amenityID: parseInt(amenity['#text'] || amenity),
      count: parseInt(amenity['@_Count']) || 1
    }));
  }

  // Helper method to parse composition rooms
  parseCompositionRooms(apiRooms) {
    if (!apiRooms) return [];
    
    const roomsArray = Array.isArray(apiRooms) ? apiRooms : [apiRooms];
    
    return roomsArray.map(room => ({
      compositionRoomID: parseInt(room['#text'] || room),
      count: parseInt(room['@_Count']) || 1
    }));
  }

  // Helper method to check if data is stale
  isDataStale(lastSyncedAt, maxAgeMinutes = 10) {
    if (!lastSyncedAt) return true;
    
    const maxAge = maxAgeMinutes * 60 * 1000; // Convert to milliseconds
    return (Date.now() - new Date(lastSyncedAt).getTime()) > maxAge;
  }
}

const unitController = new UnitController();
module.exports = unitController;