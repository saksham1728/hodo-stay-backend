const Coupon = require('../models/Coupon');
const CouponUsage = require('../models/CouponUsage');
const couponService = require('../services/couponService');

// Validate coupon
exports.validateCoupon = async (req, res) => {
  try {
    const { code, email, phone, propertyId, city, bookingAmount, nights } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone is required'
      });
    }

    const validation = await couponService.validateCoupon(code, {
      email,
      phone,
      propertyId,
      city,
      bookingAmount: parseFloat(bookingAmount),
      nights: parseInt(nights)
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate coupon',
      error: error.message
    });
  }
};

// Get available coupons for user
exports.getAvailableCoupons = async (req, res) => {
  try {
    const { email, phone } = req.query;

    const coupons = await couponService.getAvailableCoupons(email, phone);

    res.json({
      success: true,
      data: coupons
    });
  } catch (error) {
    console.error('Get available coupons error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coupons',
      error: error.message
    });
  }
};

// ============ ADMIN ENDPOINTS ============

// Create coupon
exports.createCoupon = async (req, res) => {
  try {
    const couponData = req.body;

    // Validate required fields
    if (!couponData.code || !couponData.description || !couponData.discountType || !couponData.discountValue) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if coupon code already exists
    const existing = await Coupon.findOne({ code: couponData.code.toUpperCase() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }

    const coupon = new Coupon(couponData);
    await coupon.save();

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data: coupon
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create coupon',
      error: error.message
    });
  }
};

// Get all coupons (admin)
exports.getAllCoupons = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, search } = req.query;

    const query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    if (search) {
      query.$or = [
        { code: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('properties', 'name');

    const count = await Coupon.countDocuments(query);

    res.json({
      success: true,
      data: coupons,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get all coupons error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coupons',
      error: error.message
    });
  }
};

// Get single coupon
exports.getCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id)
      .populate('properties', 'name city');

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Get usage statistics
    const usageStats = await CouponUsage.aggregate([
      { $match: { couponId: coupon._id } },
      {
        $group: {
          _id: null,
          totalUsage: { $sum: 1 },
          totalDiscount: { $sum: '$discountAmount' },
          totalRevenue: { $sum: '$finalPrice' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        coupon,
        stats: usageStats[0] || { totalUsage: 0, totalDiscount: 0, totalRevenue: 0 }
      }
    });
  } catch (error) {
    console.error('Get coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coupon',
      error: error.message
    });
  }
};

// Update coupon
exports.updateCoupon = async (req, res) => {
  try {
    const updates = req.body;
    
    // Prevent updating code if already used
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    if (updates.code && updates.code !== coupon.code && coupon.currentUsageCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change code of a coupon that has been used'
      });
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Coupon updated successfully',
      data: updatedCoupon
    });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update coupon',
      error: error.message
    });
  }
};

// Toggle coupon active status
exports.toggleCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({
      success: true,
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
      data: coupon
    });
  } catch (error) {
    console.error('Toggle coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle coupon',
      error: error.message
    });
  }
};

// Delete coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found'
      });
    }

    // Soft delete - just deactivate if already used
    if (coupon.currentUsageCount > 0) {
      coupon.isActive = false;
      await coupon.save();
      
      return res.json({
        success: true,
        message: 'Coupon deactivated (has usage history)'
      });
    }

    // Hard delete if never used
    await Coupon.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete coupon',
      error: error.message
    });
  }
};

// Get coupon usage analytics
exports.getCouponAnalytics = async (req, res) => {
  try {
    const { couponId, startDate, endDate } = req.query;

    const matchStage = {};
    if (couponId) matchStage.couponId = mongoose.Types.ObjectId(couponId);
    if (startDate || endDate) {
      matchStage.appliedAt = {};
      if (startDate) matchStage.appliedAt.$gte = new Date(startDate);
      if (endDate) matchStage.appliedAt.$lte = new Date(endDate);
    }

    const analytics = await CouponUsage.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$couponCode',
          totalUsage: { $sum: 1 },
          totalDiscount: { $sum: '$discountAmount' },
          totalRevenue: { $sum: '$finalPrice' },
          avgDiscount: { $avg: '$discountAmount' },
          uniqueUsers: { $addToSet: '$userEmail' }
        }
      },
      {
        $project: {
          couponCode: '$_id',
          totalUsage: 1,
          totalDiscount: 1,
          totalRevenue: 1,
          avgDiscount: 1,
          uniqueUsers: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { totalUsage: -1 } }
    ]);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get coupon analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
};
