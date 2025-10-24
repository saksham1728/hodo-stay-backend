const { Property, AvailabilityCalendar, SyncLog } = require('../models');
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

class PropertyController {
  // Get all properties (from MongoDB cache with optional API sync)
  async getProperties(req, res) {
    try {
      const {
        locationId = 41982,
        page = 1,
        limit = 10,
        featured = false,
        forceSync = false
      } = req.query;

      console.log(`Fetching properties for location: ${locationId}`);

      // Note: Manual sync will be triggered later if no properties found

      // Build query
      const query = {
        'location.detailedLocationID': parseInt(locationId),
        isActive: true,
        isArchived: false
      };

      if (featured === 'true') {
        query.featured = true;
      }

      // Pagination
      const skip = (page - 1) * limit;

      // Get properties from MongoDB
      let properties = await Property.find(query)
        .select('-__v')
        .sort({ featured: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      let totalProperties = await Property.countDocuments(query);

      // If no properties found and forceSync is requested, try manual sync
      if (totalProperties === 0 && forceSync === 'true') {
        console.log('No properties found in MongoDB, attempting manual sync...');
        try {
          // Direct sync without using class methods
          console.log(`Starting property sync for location: ${locationId}`);

          const xmlResponse = await ruClient.pullListProp(locationId, false);
          const parsedResponse = xmlParser.parse(xmlResponse);

          if (parsedResponse.error) {
            throw new Error(`API Error: ${parsedResponse.error}`);
          }

          const apiProperties = parsedResponse?.Pull_ListProp_RS?.Properties?.Property || [];
          const propertiesArray = Array.isArray(apiProperties) ? apiProperties : [apiProperties];

          console.log(`Found ${propertiesArray.length} properties from API`);

          for (const apiProperty of propertiesArray) {
            const propertyData = {
              ruPropertyId: apiProperty.ID,
              name: apiProperty.Name,
              ruOwnerID: apiProperty.OwnerID,
              location: {
                detailedLocationID: parseInt(apiProperty.DetailedLocationID)
              },
              isActive: true,
              isArchived: false,
              lastSyncedAt: new Date(),
              ruLastMod: new Date(apiProperty.LastMod)
            };

            await Property.findOneAndUpdate(
              { ruPropertyId: apiProperty.ID },
              propertyData,
              { upsert: true, new: true }
            );

            console.log(`✅ Synced property: ${apiProperty.Name}`);
          }

          // Re-query after sync
          properties = await Property.find(query)
            .select('-__v')
            .sort({ featured: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

          totalProperties = await Property.countDocuments(query);

          console.log(`✅ Sync completed. Found ${totalProperties} properties in MongoDB`);

        } catch (syncError) {
          console.error('Manual sync failed:', syncError);
          // Continue with empty results
        }
      }

      res.json({
        success: true,
        data: {
          properties,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalProperties / limit),
            totalProperties,
            hasNext: page * limit < totalProperties,
            hasPrev: page > 1
          },
          locationId: locationId
        }
      });

    } catch (error) {
      console.error('Error in getProperties:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get specific property details (MongoDB + fresh API data)
  async getPropertyDetails(req, res) {
    try {
      const { propertyId } = req.params;
      
      console.log(`Fetching details for property: ${propertyId}`);
      
      // Build query to find property
      let query = {};
      
      // Check if propertyId is a valid MongoDB ObjectId
      if (propertyId.match(/^[0-9a-fA-F]{24}$/)) {
        query = {
          $or: [
            { ruPropertyId: parseInt(propertyId) },
            { _id: propertyId }
          ]
        };
      } else {
        // If not a valid ObjectId, only search by ruPropertyId
        query = { ruPropertyId: parseInt(propertyId) };
      }
      
      // Get property from MongoDB (simple - no API calls)
      const property = await Property.findOne(query).lean();
      
      if (!property) {
        return res.status(404).json({
          success: false,
          message: 'Property not found'
        });
      }
      
      console.log(`Found property: ${property.name}`);
      
      res.json({
        success: true,
        data: {
          property
        }
      });
      
    } catch (error) {
      console.error('Error in getPropertyDetails:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get property availability and price quote (always fresh from API)
  async getPropertyQuote(req, res) {
    try {
      const { propertyId } = req.params;
      const { dateFrom, dateTo, guests = 1, currency = 'USD' } = req.query;

      if (!dateFrom || !dateTo) {
        return res.status(400).json({
          success: false,
          message: 'dateFrom and dateTo are required'
        });
      }

      console.log(`Getting quote for property ${propertyId}: ${dateFrom} to ${dateTo}, ${guests} guests`);

      // Check local availability first
      const unavailableDates = await AvailabilityCalendar.checkAvailability(
        propertyId,
        new Date(dateFrom),
        new Date(dateTo)
      );

      if (unavailableDates.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Selected dates are not available',
          unavailableDates: unavailableDates.map(d => d.date)
        });
      }

      // Get fresh pricing from API
      const xmlResponse = await ruClient.pullGetPropertyAvbPrice(
        propertyId,
        dateFrom,
        dateTo,
        guests,
        currency
      );
      const parsedResponse = xmlParser.parse(xmlResponse);

      // Check for errors
      if (parsedResponse.error) {
        return res.status(400).json({
          success: false,
          error: parsedResponse.error,
          message: 'Error fetching price quote from Rentals United'
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
          propertyId: propertyId,
          dateFrom: dateFrom,
          dateTo: dateTo,
          guests: guests,
          currency: currency,
          pricing: priceData,
          quoteTimestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error in getPropertyQuote:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Sync properties from Rentals United API
  async syncPropertiesFromAPI(locationId = 41982) {
    const syncLog = new SyncLog({
      syncType: 'properties_sync',
      config: { locationId },
      triggeredBy: 'api_call'
    });

    try {
      await syncLog.save();

      console.log(`Starting property sync for location: ${locationId}`);

      const xmlResponse = await ruClient.pullListProp(locationId, false);
      const parsedResponse = xmlParser.parse(xmlResponse);

      if (parsedResponse.error) {
        throw new Error(`API Error: ${parsedResponse.error}`);
      }

      const apiProperties = parsedResponse?.Pull_ListProp_RS?.Properties?.Property || [];
      const propertiesArray = Array.isArray(apiProperties) ? apiProperties : [apiProperties];

      let processedCount = 0;
      let newCount = 0;
      let updatedCount = 0;

      for (const apiProperty of propertiesArray) {
        try {
          const existingProperty = await Property.findOne({
            ruPropertyId: apiProperty.ID
          });

          if (existingProperty) {
            // Update existing property
            await Property.updateOne(
              { ruPropertyId: apiProperty.ID },
              {
                name: apiProperty.Name,
                ruOwnerID: apiProperty.OwnerID,
                'location.detailedLocationID': apiProperty.DetailedLocationID,
                ruLastMod: new Date(apiProperty.LastMod),
                lastSyncedAt: new Date(),
                isActive: apiProperty.LastMod?.['@_Active'] !== 'false'
              }
            );
            updatedCount++;
          } else {
            // Create new property
            await Property.create({
              ruPropertyId: apiProperty.ID,
              name: apiProperty.Name,
              ruOwnerID: apiProperty.OwnerID,
              location: {
                detailedLocationID: apiProperty.DetailedLocationID
              },
              ruLastMod: new Date(apiProperty.LastMod),
              lastSyncedAt: new Date(),
              isActive: apiProperty.LastMod?.['@_Active'] !== 'false'
            });
            newCount++;
          }

          processedCount++;
        } catch (error) {
          console.error(`Error processing property ${apiProperty.ID}:`, error);
          await syncLog.addError('property_processing', error.message, apiProperty.ID);
        }
      }

      await syncLog.markCompleted({
        propertiesProcessed: processedCount,
        newRecords: newCount,
        updatedRecords: updatedCount
      });

      console.log(`Property sync completed: ${processedCount} processed, ${newCount} new, ${updatedCount} updated`);

    } catch (error) {
      console.error('Property sync failed:', error);
      await syncLog.markFailed(error);
      throw error;
    }
  }

  // Update property from API data
  async updatePropertyFromAPI(apiProperty) {
    const propertyData = {
      ruPropertyId: apiProperty.ID,
      name: apiProperty.Name,
      ruOwnerID: apiProperty.OwnerID,
      description: apiProperty.Descriptions?.Description?.Text || '',

      location: {
        detailedLocationID: apiProperty.DetailedLocationID,
        street: apiProperty.Street,
        zipCode: apiProperty.ZipCode,
        coordinates: {
          latitude: parseFloat(apiProperty.Coordinates?.Latitude),
          longitude: parseFloat(apiProperty.Coordinates?.Longitude)
        }
      },

      propertyType: {
        propertyTypeID: apiProperty.PropertyTypeID,
        objectTypeID: apiProperty.ObjectTypeID
      },

      capacity: {
        standardGuests: apiProperty.StandardGuests || 1,
        canSleepMax: apiProperty.CanSleepMax || 1,
        noOfUnits: apiProperty.NoOfUnits || 1
      },

      pricing: {
        cleaningPrice: parseFloat(apiProperty.CleaningPrice) || 0,
        deposit: parseFloat(apiProperty.Deposit) || 0,
        securityDeposit: parseFloat(apiProperty.SecurityDeposit) || 0
      },

      checkInOut: {
        checkInFrom: apiProperty.CheckInOut?.CheckInFrom,
        checkInTo: apiProperty.CheckInOut?.CheckInTo,
        checkOutUntil: apiProperty.CheckInOut?.CheckOutUntil,
        place: apiProperty.CheckInOut?.Place
      },

      images: this.parseImages(apiProperty.Images?.Image),
      amenities: this.parseAmenities(apiProperty.CompositionRoomsAmenities),

      isActive: apiProperty.IsActive === 'true',
      isArchived: apiProperty.IsArchived === 'true',
      lastSyncedAt: new Date(),
      ruLastMod: new Date(apiProperty.LastMod)
    };

    return await Property.findOneAndUpdate(
      { ruPropertyId: apiProperty.ID },
      propertyData,
      { upsert: true, new: true, lean: true }
    );
  }

  // Helper method to parse images
  parseImages(apiImages) {
    if (!apiImages) return [];

    const imagesArray = Array.isArray(apiImages) ? apiImages : [apiImages];

    return imagesArray.map((img, index) => ({
      imageTypeID: img['@_ImageTypeID'],
      imageReferenceID: img['@_ImageReferenceID'],
      url: img['#text'] || img,
      isPrimary: index === 0
    }));
  }

  // Helper method to parse amenities
  parseAmenities(compositionRooms) {
    const amenities = [];

    if (compositionRooms?.CompositionRoomAmenities) {
      const roomsArray = Array.isArray(compositionRooms.CompositionRoomAmenities)
        ? compositionRooms.CompositionRoomAmenities
        : [compositionRooms.CompositionRoomAmenities];

      roomsArray.forEach(room => {
        if (room.Amenities?.Amenity) {
          const amenitiesArray = Array.isArray(room.Amenities.Amenity)
            ? room.Amenities.Amenity
            : [room.Amenities.Amenity];

          amenitiesArray.forEach(amenity => {
            amenities.push({
              amenityID: parseInt(amenity['#text'] || amenity),
              count: parseInt(amenity['@_Count']) || 1
            });
          });
        }
      });
    }

    return amenities;
  }

  // Helper method to parse composition rooms
  parseCompositionRooms(compositionRooms) {
    if (!compositionRooms) return [];

    const roomsArray = Array.isArray(compositionRooms) ? compositionRooms : [compositionRooms];

    return roomsArray.map(room => ({
      compositionRoomID: parseInt(room['@_CompositionRoomID']),
      amenities: this.parseRoomAmenities(room.Amenities?.Amenity)
    }));
  }

  // Helper method to parse room amenities
  parseRoomAmenities(amenities) {
    if (!amenities) return [];

    const amenitiesArray = Array.isArray(amenities) ? amenities : [amenities];

    return amenitiesArray.map(amenity => ({
      amenityID: parseInt(amenity['#text'] || amenity),
      count: parseInt(amenity['@_Count']) || 1
    }));
  }

  // Manual property sync method (simpler version)
  async manualPropertySync(locationId = 41982) {
    console.log(`Starting manual property sync for location: ${locationId}`);

    const xmlResponse = await ruClient.pullListProp(locationId, false);
    const parsedResponse = xmlParser.parse(xmlResponse);

    if (parsedResponse.error) {
      throw new Error(`API Error: ${parsedResponse.error}`);
    }

    const apiProperties = parsedResponse?.Pull_ListProp_RS?.Properties?.Property || [];
    const propertiesArray = Array.isArray(apiProperties) ? apiProperties : [apiProperties];

    console.log(`Found ${propertiesArray.length} properties from API`);

    for (const apiProperty of propertiesArray) {
      const propertyData = {
        ruPropertyId: apiProperty.ID,
        name: apiProperty.Name,
        ruOwnerID: apiProperty.OwnerID,
        location: {
          detailedLocationID: parseInt(apiProperty.DetailedLocationID)
        },
        isActive: true,
        isArchived: false,
        lastSyncedAt: new Date(),
        ruLastMod: new Date(apiProperty.LastMod)
      };

      await Property.findOneAndUpdate(
        { ruPropertyId: apiProperty.ID },
        propertyData,
        { upsert: true, new: true }
      );

      console.log(`✅ Synced property: ${apiProperty.Name}`);
    }

    return propertiesArray.length;
  }

  // Helper method to check if data is stale
  isDataStale(lastSyncedAt, maxAgeHours = 24) {
    if (!lastSyncedAt) return true;

    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
    return (Date.now() - new Date(lastSyncedAt).getTime()) > maxAge;
  }
}

const propertyController = new PropertyController();
module.exports = propertyController;