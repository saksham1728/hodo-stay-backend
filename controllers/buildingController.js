// Use environment variable to switch between MongoDB and Supabase
const USE_SUPABASE = process.env.DATABASE_TYPE === 'supabase';

// MongoDB models (legacy)
const { Building: MongooseBuilding, Unit: MongooseUnit, Booking: MongooseBooking } = require('../models');

// Supabase repositories (new)
const buildingRepository = require('../repositories/buildingRepository');
const unitRepository = require('../repositories/unitRepository');
const bookingRepository = require('../repositories/bookingRepository');

const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

// Adapters to use either MongoDB or Supabase
const Building = USE_SUPABASE ? buildingRepository : MongooseBuilding;
const Unit = USE_SUPABASE ? unitRepository : MongooseUnit;
const Booking = USE_SUPABASE ? bookingRepository : MongooseBooking;

class BuildingController {
  /**
   * Get all buildings with complete data
   */
  async getAllBuildings(req, res) {
    try {
      let buildings;
      
      if (USE_SUPABASE) {
        buildings = await Building.find({ isActive: true });
      } else {
        buildings = await Building.find({ isActive: true });
      }
      
      // Format buildings for frontend compatibility
      const formattedBuildings = buildings.map(building => ({
        _id: building._id || building.id,
        name: building.name,
        title: building.title || building.name,
        subTitle: building.subTitle,
        slug: building.slug,
        description: building.description,
        
        // Location - use new structure, fallback to legacy
        location: building.location?.city ? building.location : {
          addressLine1: building.legacyLocation?.address || '',
          city: building.legacyLocation?.city || '',
          state: building.legacyLocation?.state || '',
          country: building.legacyLocation?.country || '',
          pincode: building.legacyLocation?.zipCode || ''
        },
        
        // Images - provide both formats
        images: building.images || [],
        gallery: building.gallery || [],
        heroImage: building.heroImage,
        
        // Amenities - provide both formats
        amenities: building.amenities || [],
        legacyAmenities: building.legacyAmenities || [],
        
        // New content fields
        highlights: building.highlights || [],
        accessibility: building.accessibility || [],
        policies: building.policies || [],
        reviewSummary: building.reviewSummary || [],
        reviews: building.reviews || [],
        roomTypes: building.roomTypes || [],
        seo: building.seo,
        
        // Metadata
        totalUnits: building.totalUnits,
        isActive: building.isActive,
        createdAt: building.createdAt,
        updatedAt: building.updatedAt
      }));
      
      res.json({
        success: true,
        data: { buildings: formattedBuildings }
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
   * Get building by ID with all units and complete data
   */
  async getBuildingById(req, res) {
    try {
      const { buildingId } = req.params;
      
      let building;
      if (USE_SUPABASE) {
        building = await Building.findById(buildingId);
      } else {
        building = await Building.findById(buildingId);
      }
      
      if (!building) {
        return res.status(404).json({
          success: false,
          message: 'Building not found'
        });
      }

      // Get all units for this building
      let units;
      if (USE_SUPABASE) {
        units = await Unit.find({ buildingId, isActive: true, isArchived: false });
      } else {
        units = await Unit.find({ buildingId, isActive: true, isArchived: false });
      }

      // Format building data for frontend
      const formattedBuilding = {
        _id: building._id || building.id,
        name: building.name,
        title: building.title || building.name,
        subTitle: building.subTitle,
        slug: building.slug,
        description: building.description,
        
        // Location - use new structure, fallback to legacy
        location: building.location?.city ? building.location : {
          addressLine1: building.legacyLocation?.address || '',
          city: building.legacyLocation?.city || '',
          state: building.legacyLocation?.state || '',
          country: building.legacyLocation?.country || '',
          pincode: building.legacyLocation?.zipCode || '',
          latitude: building.legacyLocation?.coordinates?.latitude,
          longitude: building.legacyLocation?.coordinates?.longitude
        },
        
        // Images - provide both formats
        images: building.images || [],
        gallery: building.gallery || [],
        heroImage: building.heroImage,
        
        // Amenities - provide both formats
        amenities: building.amenities || [],
        legacyAmenities: building.legacyAmenities || [],
        
        // New content fields
        highlights: building.highlights || [],
        accessibility: building.accessibility || [],
        policies: building.policies || [],
        reviewSummary: building.reviewSummary || [],
        reviews: building.reviews || [],
        roomTypes: building.roomTypes || [],
        seo: building.seo,
        
        // Metadata
        totalUnits: building.totalUnits,
        isActive: building.isActive,
        createdAt: building.createdAt,
        updatedAt: building.updatedAt
      };

      res.json({
        success: true,
        data: {
          building: formattedBuilding,
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
   * Get building with unit types grouped and complete data
   * Shows: "2BHK (8 available)", "2BHK Penthouse (1 available)", etc.
   */
  async getBuildingWithUnitTypes(req, res) {
    try {
      const { buildingId } = req.params;

      let building;
      if (USE_SUPABASE) {
        building = await Building.findById(buildingId);
      } else {
        building = await Building.findById(buildingId);
      }
      
      if (!building) {
        return res.status(404).json({
          success: false,
          message: 'Building not found'
        });
      }

      // Get all active units
      let allUnits;
      if (USE_SUPABASE) {
        allUnits = await Unit.find({ 
          buildingId,
          isActive: true,
          isArchived: false
        });
      } else {
        allUnits = await Unit.find({ 
          buildingId,
          isActive: true,
          isArchived: false
        });
      }

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
            _id: unit._id || unit.id,
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

      // Format building data for frontend
      const formattedBuilding = {
        _id: building._id || building.id,
        name: building.name,
        title: building.title || building.name,
        subTitle: building.subTitle,
        slug: building.slug,
        description: building.description,
        
        // Location
        location: building.location?.city ? building.location : {
          addressLine1: building.legacyLocation?.address || '',
          city: building.legacyLocation?.city || '',
          state: building.legacyLocation?.state || '',
          country: building.legacyLocation?.country || '',
          pincode: building.legacyLocation?.zipCode || '',
          latitude: building.legacyLocation?.coordinates?.latitude,
          longitude: building.legacyLocation?.coordinates?.longitude
        },
        
        // Images
        images: building.images || [],
        gallery: building.gallery || [],
        heroImage: building.heroImage,
        
        // Amenities
        amenities: building.amenities || [],
        
        // New content fields
        highlights: building.highlights || [],
        accessibility: building.accessibility || [],
        policies: building.policies || [],
        reviewSummary: building.reviewSummary || [],
        reviews: building.reviews || [],
        roomTypes: building.roomTypes || [],
        seo: building.seo,
        
        // Metadata
        totalUnits: building.totalUnits,
        isActive: building.isActive
      };

      res.json({
        success: true,
        data: {
          building: formattedBuilding,
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
   * Get cheapest available unit for a unit type using CACHE
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
      let units;
      if (USE_SUPABASE) {
        units = await Unit.find({
          buildingId,
          unitType,
          isActive: true,
          isArchived: false
        });
      } else {
        units = await Unit.find({
          buildingId,
          unitType,
          isActive: true,
          isArchived: false
        });
      }

      console.log(`📊 Found ${units.length} units of type "${unitType}"`);

      if (units.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No units found for this type'
        });
      }

      // Check which units are already booked locally
      let bookedUnitIds;
      if (USE_SUPABASE) {
        const bookings = await Booking.find({
          buildingId,
          status: { $in: ['confirmed', 'pending'] },
          checkInDate: { $lt: new Date(checkOut) },
          checkOutDate: { $gt: new Date(checkIn) }
        });
        bookedUnitIds = bookings.map(b => b.unitId);
      } else {
        bookedUnitIds = await Booking.find({
          buildingId,
          status: { $in: ['confirmed', 'pending'] },
          $or: [
            {
              checkInDate: { $lt: new Date(checkOut) },
              checkOutDate: { $gt: new Date(checkIn) }
            }
          ]
        }).distinct('unitId');
      }

      console.log(`🔒 ${bookedUnitIds.length} units already booked locally`);

      // Filter out booked units
      let availableUnits = units.filter(unit => {
        const unitId = unit._id || unit.id;
        return !bookedUnitIds.some(bookedId => bookedId.toString() === unitId.toString());
      });

      console.log(`✅ ${availableUnits.length} units available locally`);

      // Filter by guest capacity if guests parameter is provided
      if (guests && parseInt(guests) > 0) {
        const requestedGuests = parseInt(guests);
        const unitsBeforeGuestFilter = availableUnits.length;
        
        availableUnits = availableUnits.filter(unit => {
          const maxCapacity = unit.canSleepMax || unit.standardGuests || 1;
          const canAccommodate = maxCapacity >= requestedGuests;
          if (!canAccommodate) {
            console.log(`  ✗ ${unit.name} can only accommodate ${maxCapacity} guests (requested: ${requestedGuests})`);
          }
          return canAccommodate;
        });

        console.log(`👥 Guest filter: ${unitsBeforeGuestFilter} units → ${availableUnits.length} units can accommodate ${requestedGuests} guests`);

        if (availableUnits.length === 0) {
          return res.status(400).json({
            success: false,
            message: `No units of type "${unitType}" can accommodate ${requestedGuests} guests. Please select a different unit type or reduce the number of guests.`,
            unitType,
            requestedGuests,
            maxGuestsForType: Math.max(...units.map(u => u.canSleepMax || u.standardGuests || 0))
          });
        }
      }

      if (availableUnits.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No units available for selected dates',
          unitType
        });
      }

      // Check pricing for ALL available units using CACHE
      const PropertyDailyCache = require('../models/PropertyDailyCache');
      const { applyMarkup, calculateMarkupAmount, getMarkupPercentage } = require('../utils/pricingMarkup');
      
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
      
      const unitsWithPricing = [];

      for (const unit of availableUnits) {
        try {
          const unitId = unit._id || unit.id;
          console.log(`💰 Checking cached pricing for unit ${unit.name}`);
          
          // Query cache for date range
          const cachedDays = await PropertyDailyCache.find({
            unitId: unitId,
            date: {
              $gte: checkInDate,
              $lt: checkOutDate
            }
          }).sort({ date: 1 });

          // Check if we have data for all nights
          if (cachedDays.length !== nights) {
            console.log(`  ⚠️  Missing cache data (${cachedDays.length}/${nights} days)`);
            continue;
          }

          // Check if all days are available
          const allAvailable = cachedDays.every(day => day.isAvailable);
          
          if (!allAvailable) {
            console.log(`  ✗ Not available (some days blocked)`);
            continue;
          }

          // Calculate base price from cache
          const basePrice = cachedDays.reduce((sum, day) => sum + day.pricePerNight, 0);
          const basePriceRounded = Math.round(basePrice * 100) / 100;
          
          console.log(`  📊 Base price from cache: ₹${basePriceRounded} (${nights} nights)`);
          
          // Apply 10% markup
          const markupAmount = calculateMarkupAmount(basePriceRounded);
          const totalPrice = applyMarkup(basePriceRounded);
          const markupPercentage = getMarkupPercentage();
          
          console.log(`  💵 Markup calculation:`);
          console.log(`     Base Price: ₹${basePriceRounded}`);
          console.log(`     Markup (${markupPercentage}%): ₹${markupAmount}`);
          console.log(`     Final Price: ₹${totalPrice}`);
          
          const avgPricePerNight = totalPrice / nights;

          unitsWithPricing.push({
            unit,
            pricing: {
              propertyId: unit.ruPropertyId,
              basePrice: basePriceRounded,
              markup: markupAmount,
              markupPercentage: markupPercentage,
              price: totalPrice,
              available: true,
              currency: 'INR',
              pricePerNight: Math.round(avgPricePerNight * 100) / 100,
              nights
            }
          });
          console.log(`  ✓ Available at ₹${totalPrice} (base: ₹${basePriceRounded} + markup: ₹${markupAmount})`);
        } catch (error) {
          console.error(`  ✗ Error checking unit ${unit.name}:`, error.message);
        }
      }

      if (unitsWithPricing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No units available in cache for selected dates',
          unitType
        });
      }

      // Sort by price and get cheapest
      unitsWithPricing.sort((a, b) => a.pricing.price - b.pricing.price);
      const cheapest = unitsWithPricing[0];

      console.log(`🎯 Cheapest unit: ${cheapest.unit.name}`);
      console.log(`   Base Price: ₹${cheapest.pricing.basePrice}`);
      console.log(`   Markup (${cheapest.pricing.markupPercentage}%): ₹${cheapest.pricing.markup}`);
      console.log(`   Final Price: ₹${cheapest.pricing.price}`);

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
  /**
   * Create a new building
   */
  async createBuilding(req, res) {
    try {
      const buildingData = req.body;

      // Create new building
      let building;
      if (USE_SUPABASE) {
        building = await Building.create(buildingData);
      } else {
        building = new Building(buildingData);
        await building.save();
      }

      console.log('✅ Building created:', building.name);

      res.status(201).json({
        success: true,
        data: { building },
        message: 'Building created successfully'
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

  /**
   * Update an existing building
   */
  async updateBuilding(req, res) {
    try {
      const { buildingId } = req.params;
      const updateData = req.body;

      let building;
      if (USE_SUPABASE) {
        building = await Building.findByIdAndUpdate(buildingId, updateData);
      } else {
        building = await Building.findByIdAndUpdate(
          buildingId,
          updateData,
          { new: true, runValidators: true }
        );
      }

      if (!building) {
        return res.status(404).json({
          success: false,
          message: 'Building not found'
        });
      }

      console.log('✅ Building updated:', building.name);

      res.json({
        success: true,
        data: { building },
        message: 'Building updated successfully'
      });
    } catch (error) {
      console.error('Error updating building:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update building',
        error: error.message
      });
    }
  }

  /**
   * Soft delete a building (set isActive to false)
   */
  async deleteBuilding(req, res) {
    try {
      const { buildingId } = req.params;

      let building;
      if (USE_SUPABASE) {
        building = await Building.findByIdAndUpdate(buildingId, { isActive: false });
      } else {
        building = await Building.findByIdAndUpdate(
          buildingId,
          { isActive: false },
          { new: true }
        );
      }

      if (!building) {
        return res.status(404).json({
          success: false,
          message: 'Building not found'
        });
      }

      console.log('✅ Building deactivated:', building.name);

      res.json({
        success: true,
        message: 'Building deactivated successfully'
      });
    } catch (error) {
      console.error('Error deleting building:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete building',
        error: error.message
      });
    }
  }
}

const buildingController = new BuildingController();
module.exports = buildingController;
