const { Building, Unit, Booking } = require('../models');
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

class BuildingController {
  /**
   * Get all buildings
   */
  async getAllBuildings(req, res) {
    try {
      const buildings = await Building.find({ isActive: true });
      
      res.json({
        success: true,
        data: { buildings }
      });
    } catch (error) {
      console.error('Error fetching buildings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch buildings',
        error: error.message
      });
    }
  }

  /**
   * Get building by ID with all units
   */
  async getBuildingById(req, res) {
    try {
      const { buildingId } = req.params;
      
      const building = await Building.findById(buildingId);
      
      if (!building) {
        return res.status(404).json({
          success: false,
          message: 'Building not found'
        });
      }

      // Get all units for this building
      const units = await Unit.find({ buildingId, isActive: true, isArchived: false });

      res.json({
        success: true,
        data: {
          building,
          units
        }
      });
    } catch (error) {
      console.error('Error fetching building:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch building',
        error: error.message
      });
    }
  }

  /**
   * Get building with unit types grouped
   * Shows: "2BHK (8 available)", "2BHK Penthouse (1 available)", etc.
   */
  async getBuildingWithUnitTypes(req, res) {
    try {
      const { buildingId } = req.params;

      const building = await Building.findById(buildingId);
      if (!building) {
        return res.status(404).json({
          success: false,
          message: 'Building not found'
        });
      }

      // Get all active units
      const allUnits = await Unit.find({ 
        buildingId,
        isActive: true,
        isArchived: false
      });

      // Group by unitType
      const unitTypesMap = {};
      
      allUnits.forEach(unit => {
        const type = unit.unitType;
        
        if (!unitTypesMap[type]) {
          unitTypesMap[type] = {
            unitType: type,
            unitTypeSlug: unit.unitTypeSlug,
            count: 0,
            representativeUnit: null
          };
        }

        unitTypesMap[type].count++;
        
        // Use representative unit, or first unit as fallback
        if (unit.isRepresentative || !unitTypesMap[type].representativeUnit) {
          unitTypesMap[type].representativeUnit = {
            _id: unit._id,
            name: unit.name,
            description: unit.description,
            images: unit.images,
            amenities: unit.amenities,
            space: unit.space,
            standardGuests: unit.standardGuests,
            canSleepMax: unit.canSleepMax
          };
        }
      });

      const unitTypes = Object.values(unitTypesMap);

      res.json({
        success: true,
        data: {
          building,
          unitTypes,
          totalUnits: allUnits.length
        }
      });

    } catch (error) {
      console.error('Error fetching building with unit types:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch building details',
        error: error.message
      });
    }
  }

  /**
   * Get cheapest available unit for a unit type with live pricing
   * Checks ALL units of the type and returns the cheapest available one
   */
  async getBestAvailableUnit(req, res) {
    try {
      const { unitType, buildingId, checkIn, checkOut, guests } = req.body;

      console.log('🔍 getBestAvailableUnit called with:', { unitType, buildingId, checkIn, checkOut, guests });

      if (!unitType || !buildingId || !checkIn || !checkOut) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      // Get all units of this type
      const units = await Unit.find({
        buildingId,
        unitType,
        isActive: true,
        isArchived: false
      });

      console.log(`📊 Found ${units.length} units of type "${unitType}"`);

      if (units.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No units found for this type'
        });
      }

      // Check which units are already booked locally
      const bookedUnitIds = await Booking.find({
        buildingId,
        status: { $in: ['confirmed', 'pending'] },
        $or: [
          {
            checkInDate: { $lt: new Date(checkOut) },
            checkOutDate: { $gt: new Date(checkIn) }
          }
        ]
      }).distinct('unitId');

      console.log(`🔒 ${bookedUnitIds.length} units already booked locally`);

      // Filter out booked units
      const availableUnits = units.filter(unit => 
        !bookedUnitIds.some(bookedId => bookedId.toString() === unit._id.toString())
      );

      console.log(`✅ ${availableUnits.length} units available locally`);

      if (availableUnits.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No units available for selected dates',
          unitType
        });
      }

      // Check pricing for ALL available units and find cheapest
      const unitsWithPricing = [];

      for (const unit of availableUnits) {
        try {
          console.log(`💰 Checking pricing for unit ${unit.name} (RU ID: ${unit.ruPropertyId})`);
          
          // Call RU API directly
          const response = await ruClient.pullGetPropertyAvbPrice(
            unit.ruPropertyId,
            checkIn,
            checkOut,
            null // No NOP parameter
          );

          const parsedResponse = xmlParser.parse(response);
          const priceData = parsedResponse.Pull_GetPropertyAvbPrice_RS;
          
          // Check for error status (Status ID != 0 means error)
          if (priceData && priceData.Status) {
            const statusId = priceData.Status['@_ID'] || priceData.Status.ID;
            
            // Status ID 0 = Success, anything else is an error
            if (statusId && statusId !== '0' && statusId !== 0) {
              console.log(`  ✗ Not available (Status ${statusId})`);
              continue;
            }
          }
          
          // Parse PropertyPrices structure
          if (priceData && priceData.PropertyPrices) {
            const propertyPrices = priceData.PropertyPrices;
            const propertyPrice = propertyPrices.PropertyPrice;
            
            if (propertyPrice) {
              const price = parseFloat(propertyPrice['#text'] || propertyPrice || 0);
              const currency = propertyPrices['@_Currency'] || 'USD';
              const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));

              unitsWithPricing.push({
                unit,
                pricing: {
                  propertyId: unit.ruPropertyId,
                  price,
                  available: true,
                  currency,
                  pricePerNight: price / nights,
                  nights
                }
              });
              console.log(`  ✓ Available at ${currency} ${price}`);
            }
          } else {
            console.log(`  ✗ Not available in RU`);
          }
        } catch (error) {
          console.error(`  ✗ Error checking unit ${unit.name}:`, error.message);
        }
      }

      if (unitsWithPricing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No units available in Rentals United for selected dates',
          unitType
        });
      }

      // Sort by price and get cheapest
      unitsWithPricing.sort((a, b) => a.pricing.price - b.pricing.price);
      const cheapest = unitsWithPricing[0];

      console.log(`🎯 Cheapest unit: ${cheapest.unit.name} at ${cheapest.pricing.currency} ${cheapest.pricing.price}`);

      return res.json({
        success: true,
        data: {
          unit: cheapest.unit,
          pricing: cheapest.pricing,
          unitType,
          availableUnits: unitsWithPricing.length,
          totalUnitsOfType: units.length
        }
      });

    } catch (error) {
      console.error('Error getting best available unit:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get available unit',
        error: error.message
      });
    }
  }
}

const buildingController = new BuildingController();
module.exports = buildingController;
