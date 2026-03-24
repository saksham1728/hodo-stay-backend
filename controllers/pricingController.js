const PropertyDailyCache = require('../models/PropertyDailyCache');
const Unit = require('../models/Unit');
const propertyCacheSync = require('../services/propertyCacheSync');

/**
 * Search available units with cached pricing
 * GET /api/pricing/search?roomType=2bhk&checkIn=2024-03-01&checkOut=2024-03-04&buildingId=xxx
 */
exports.searchAvailableUnits = async (req, res) => {
  try {
    const { checkIn, checkOut, buildingId, roomType } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'checkIn and checkOut dates are required'
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    // Validate dates
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date'
      });
    }

    // Build unit query
    const unitQuery = { isActive: true };
    if (buildingId) unitQuery.buildingId = buildingId;
    if (roomType) unitQuery.roomType = roomType;

    // Get all matching units
    const units = await Unit.find(unitQuery).populate('buildingId');

    // For each unit, check availability and get pricing from cache
    const availableUnits = [];

    for (const unit of units) {
      // Query cache for all days in the date range
      const cachedDays = await PropertyDailyCache.find({
        unitId: unit._id,
        date: {
          $gte: checkInDate,
          $lt: checkOutDate
        }
      }).sort({ date: 1 });

      // Calculate number of nights
      const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

      // Check if we have data for all nights
      if (cachedDays.length !== nights) {
        console.log(`⚠️  Unit ${unit._id} missing cache data (${cachedDays.length}/${nights} days)`);
        continue; // Skip this unit if cache is incomplete
      }

      // Check if all days are available
      const allAvailable = cachedDays.every(day => day.isAvailable);
      
      if (!allAvailable) {
        continue; // Skip unavailable units
      }

      // Calculate total price
      const totalPrice = cachedDays.reduce((sum, day) => sum + day.pricePerNight, 0);
      const avgPricePerNight = totalPrice / nights;

      availableUnits.push({
        unitId: unit._id,
        name: unit.name,
        roomType: unit.roomType,
        building: unit.buildingId ? {
          id: unit.buildingId._id,
          name: unit.buildingId.name,
          location: unit.buildingId.location
        } : null,
        pricing: {
          totalPrice: Math.round(totalPrice * 100) / 100,
          pricePerNight: Math.round(avgPricePerNight * 100) / 100,
          currency: 'INR',
          nights: nights
        },
        checkIn: checkIn,
        checkOut: checkOut,
        available: true
      });
    }

    // Sort by price (lowest first)
    availableUnits.sort((a, b) => a.pricing.totalPrice - b.pricing.totalPrice);

    res.json({
      success: true,
      data: {
        units: availableUnits,
        count: availableUnits.length,
        searchParams: {
          checkIn,
          checkOut,
          nights: Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24)),
          buildingId,
          roomType
        }
      }
    });

  } catch (error) {
    console.error('Error searching available units:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search available units',
      details: error.message
    });
  }
};

/**
 * Get pricing for specific unit
 * GET /api/pricing/unit/:unitId?checkIn=2024-03-01&checkOut=2024-03-04
 */
exports.getUnitPricing = async (req, res) => {
  try {
    const { unitId } = req.params;
    const { checkIn, checkOut } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'checkIn and checkOut dates are required'
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Validate dates
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date'
      });
    }

    // Get unit
    const unit = await Unit.findById(unitId).populate('buildingId');
    if (!unit) {
      return res.status(404).json({
        success: false,
        error: 'Unit not found'
      });
    }

    // Query cache for all days in the date range
    const cachedDays = await PropertyDailyCache.find({
      unitId: unit._id,
      date: {
        $gte: checkInDate,
        $lt: checkOutDate
      }
    }).sort({ date: 1 });

    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    // Check if we have data for all nights
    if (cachedDays.length !== nights) {
      return res.status(404).json({
        success: false,
        error: 'Pricing data not available for selected dates',
        details: `Missing cache data (${cachedDays.length}/${nights} days)`
      });
    }

    // Check if all days are available
    const allAvailable = cachedDays.every(day => day.isAvailable);

    // Calculate pricing
    const totalPrice = cachedDays.reduce((sum, day) => sum + day.pricePerNight, 0);
    const avgPricePerNight = totalPrice / nights;

    // Build daily breakdown
    const dailyPrices = cachedDays.map(day => ({
      date: day.date.toISOString().split('T')[0],
      price: day.pricePerNight,
      available: day.isAvailable
    }));

    res.json({
      success: true,
      data: {
        unitId: unit._id,
        name: unit.name,
        roomType: unit.roomType,
        available: allAvailable,
        pricing: {
          totalPrice: Math.round(totalPrice * 100) / 100,
          pricePerNight: Math.round(avgPricePerNight * 100) / 100,
          currency: 'INR',
          nights: nights,
          dailyBreakdown: dailyPrices
        },
        checkIn: checkIn,
        checkOut: checkOut,
        building: unit.buildingId ? {
          id: unit.buildingId._id,
          name: unit.buildingId.name,
          location: unit.buildingId.location
        } : null
      }
    });

  } catch (error) {
    console.error('Error getting unit pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unit pricing',
      details: error.message
    });
  }
};

/**
 * Trigger manual sync (admin only)
 * POST /api/pricing/sync
 */
exports.triggerSync = async (req, res) => {
  try {
    console.log('🔄 Manual sync triggered');
    
    const result = await propertyCacheSync.syncAllUnits();
    await propertyCacheSync.cleanupOldData();

    res.json({
      success: true,
      message: 'Sync completed successfully',
      data: {
        successCount: result.successCount,
        errorCount: result.errorCount,
        duration: result.duration
      }
    });

  } catch (error) {
    console.error('Error triggering sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger sync',
      details: error.message
    });
  }
};

/**
 * Check availability for specific unit and dates (final check before payment)
 * POST /api/pricing/check-availability
 */
exports.checkAvailability = async (req, res) => {
  try {
    const { unitId, checkIn, checkOut } = req.body;

    if (!unitId || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'unitId, checkIn, and checkOut are required'
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Validate dates
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format'
      });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date'
      });
    }

    // Get unit
    const unit = await Unit.findById(unitId);
    if (!unit) {
      return res.status(404).json({
        success: false,
        available: false,
        error: 'Unit not found'
      });
    }

    // Query cache for all days in the date range
    const cachedDays = await PropertyDailyCache.find({
      unitId: unit._id,
      date: {
        $gte: checkInDate,
        $lt: checkOutDate
      }
    }).sort({ date: 1 });

    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    // Check if we have data for all nights
    if (cachedDays.length !== nights) {
      return res.status(200).json({
        success: true,
        available: false,
        reason: 'Availability data not complete',
        message: 'Unable to verify availability for selected dates'
      });
    }

    // Check if all days are available
    const allAvailable = cachedDays.every(day => day.isAvailable);

    if (!allAvailable) {
      // Find which dates are not available
      const unavailableDates = cachedDays
        .filter(day => !day.isAvailable)
        .map(day => day.date.toISOString().split('T')[0]);

      return res.status(200).json({
        success: true,
        available: false,
        reason: 'Unit not available for selected dates',
        message: 'This unit is no longer available for the selected dates. It may have been booked by another guest.',
        unavailableDates
      });
    }

    // All checks passed - unit is available
    res.json({
      success: true,
      available: true,
      message: 'Unit is available for selected dates',
      nights
    });

  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      available: false,
      error: 'Failed to check availability',
      details: error.message
    });
  }
};

/**
 * Get sync status
 * GET /api/pricing/sync-status
 */
exports.getSyncStatus = async (req, res) => {
  try {
    const totalRecords = await PropertyDailyCache.countDocuments();
    
    // Get last sync time (most recent record)
    const lastRecord = await PropertyDailyCache.findOne().sort({ lastSynced: -1 });
    
    // Get active units count
    const activeUnits = await Unit.countDocuments({ 
      isActive: true, 
      ruPropertyId: { $exists: true, $ne: null } 
    });

    // Expected records (181 days per unit)
    const expectedRecords = activeUnits * 181;
    const coverage = activeUnits > 0 ? (totalRecords / expectedRecords * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        totalRecords,
        activeUnits,
        expectedRecords,
        coverage: `${coverage}%`,
        lastSynced: lastRecord ? lastRecord.lastSynced : null,
        status: coverage >= 90 ? 'healthy' : coverage >= 50 ? 'partial' : 'critical'
      }
    });

  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
      details: error.message
    });
  }
};

/**
 * Calculate GST for a booking
 * POST /api/pricing/calculate-gst
 * Body: { totalPrice, nights, couponDiscount }
 */
exports.calculateGST = async (req, res) => {
  try {
    const { totalPrice, nights, couponDiscount = 0 } = req.body;

    if (!totalPrice || !nights) {
      return res.status(400).json({
        success: false,
        error: 'totalPrice and nights are required'
      });
    }

    if (totalPrice <= 0 || nights <= 0) {
      return res.status(400).json({
        success: false,
        error: 'totalPrice and nights must be greater than zero'
      });
    }

    const gstCalculator = require('../utils/gstCalculator');

    // Calculate price after coupon
    const priceAfterCoupon = totalPrice - couponDiscount;

    if (priceAfterCoupon <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Price after coupon must be greater than zero'
      });
    }

    // Calculate GST
    const gstCalculation = gstCalculator.calculateGST(priceAfterCoupon, nights);

    res.json({
      success: true,
      data: {
        originalPrice: totalPrice,
        couponDiscount: couponDiscount,
        priceAfterCoupon: priceAfterCoupon,
        gst: {
          priceBeforeGST: gstCalculation.priceBeforeGST,
          pricePerNight: gstCalculation.pricePerNight,
          gstRate: gstCalculation.gstRate,
          gstAmount: gstCalculation.gstAmount,
          finalPrice: gstCalculation.finalPrice
        },
        breakdown: gstCalculation.breakdown
      }
    });

  } catch (error) {
    console.error('Error calculating GST:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate GST',
      details: error.message
    });
  }
};
