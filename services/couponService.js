// Use environment variable to switch between MongoDB and Supabase
const USE_SUPABASE = process.env.DATABASE_TYPE === 'supabase';

// MongoDB models (legacy)
const MongooseCoupon = require('../models/Coupon');
const MongooseBooking = require('../models/Booking');
const MongooseCouponUsage = require('../models/CouponUsage');

// Supabase repositories (new)
const couponRepository = require('../repositories/couponRepository');
const bookingRepository = require('../repositories/bookingRepository');

// Adapters to use either MongoDB or Supabase
const Coupon = USE_SUPABASE ? couponRepository : MongooseCoupon;
const Booking = USE_SUPABASE ? bookingRepository : MongooseBooking;

class CouponService {
  /**
   * Validate coupon and calculate discount
   */
  async validateCoupon(couponCode, bookingData) {
    const { email, phone, propertyId, city, bookingAmount, nights } = bookingData;

    // 1. Find coupon
    let coupon;
    if (USE_SUPABASE) {
      coupon = await Coupon.findValidCoupon(couponCode);
    } else {
      coupon = await Coupon.findValidCoupon(couponCode);
    }
    
    if (!coupon) {
      return {
        valid: false,
        error: 'Invalid or expired coupon code'
      };
    }

    // 2. Check if active
    if (!coupon.isActive) {
      return {
        valid: false,
        error: 'This coupon is no longer active'
      };
    }

    // 3. Check expiry
    const now = new Date();
    const isExpired = now < new Date(coupon.validFrom) || now > new Date(coupon.validUntil);
    if (isExpired) {
      return {
        valid: false,
        error: 'This coupon has expired'
      };
    }

    // 4. Check total usage limit
    if (coupon.usageType === 'limited_total') {
      if (coupon.currentUsageCount >= coupon.maxTotalUsage) {
        return {
          valid: false,
          error: 'This coupon has reached its usage limit'
        };
      }
    }

    // 5. Check user eligibility - New users only
    if (coupon.newUsersOnly) {
      let existingBookings;
      if (USE_SUPABASE) {
        const bookings = await Booking.find({
          'guestInfo.email': email?.toLowerCase(),
          status: { $in: ['confirmed', 'completed'] }
        });
        const bookings2 = await Booking.find({
          'guestInfo.phone': phone,
          status: { $in: ['confirmed', 'completed'] }
        });
        existingBookings = bookings.length + bookings2.length;
      } else {
        existingBookings = await Booking.countDocuments({
          $or: [
            { 'guestInfo.email': email?.toLowerCase() },
            { 'guestInfo.phone': phone }
          ],
          status: { $in: ['confirmed', 'completed'] }
        });
      }

      if (existingBookings > 0) {
        return {
          valid: false,
          error: 'This coupon is only valid for new users'
        };
      }
    }

    // 6. Check specific users list
    if (coupon.specificUsers && coupon.specificUsers.length > 0) {
      const isSpecificUser = coupon.specificUsers.some(user => 
        user === email?.toLowerCase() || user === phone
      );
      
      if (!isSpecificUser) {
        return {
          valid: false,
          error: 'This coupon is not available for your account'
        };
      }
    }

    // 7. Check excluded users
    if (coupon.excludedUsers && coupon.excludedUsers.length > 0) {
      const isExcluded = coupon.excludedUsers.some(user => 
        user === email?.toLowerCase() || user === phone
      );
      
      if (isExcluded) {
        return {
          valid: false,
          error: 'This coupon is not available for your account'
        };
      }
    }

    // 8. Check per-user usage limit
    if (coupon.usageType === 'limited_per_user') {
      // Get user usage from usedBy array
      const userUsage = coupon.usedBy?.find(u => 
        u.email === email?.toLowerCase() || u.phone === phone
      );
      const usageCount = userUsage ? userUsage.usageCount : 0;
      
      if (usageCount >= coupon.maxUsagePerUser) {
        return {
          valid: false,
          error: `You have already used this coupon ${coupon.maxUsagePerUser} time(s)`
        };
      }
    }

    // 9. Check property/city scope
    if (coupon.applicableOn === 'property') {
      if (!coupon.properties.some(p => p.toString() === propertyId?.toString())) {
        return {
          valid: false,
          error: 'This coupon is not valid for this property'
        };
      }
    }

    if (coupon.applicableOn === 'city') {
      if (!coupon.cities.includes(city?.toLowerCase())) {
        return {
          valid: false,
          error: 'This coupon is not valid for this city'
        };
      }
    }

    // 10. Check minimum booking amount
    if (bookingAmount < coupon.minBookingAmount) {
      return {
        valid: false,
        error: `Minimum booking amount of Rs ${coupon.minBookingAmount} required`
      };
    }

    // 11. Check minimum nights (optional - skip if minNights is 0 or 1)
    if (coupon.minNights && coupon.minNights > 1 && nights < coupon.minNights) {
      return {
        valid: false,
        error: `Minimum ${coupon.minNights} night(s) required`
      };
    }

    // 12. Calculate discount
    const discount = this.calculateDiscount(coupon, bookingAmount);

    return {
      valid: true,
      coupon: {
        id: coupon._id || coupon.id,
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      },
      discount: {
        amount: discount,
        originalPrice: bookingAmount,
        finalPrice: bookingAmount - discount
      }
    };
  }

  /**
   * Calculate discount amount
   */
  calculateDiscount(coupon, bookingAmount) {
    let discount = 0;

    if (coupon.discountType === 'percentage') {
      discount = (bookingAmount * coupon.discountValue) / 100;
      
      // Apply max discount cap if set
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount;
      }
    } else if (coupon.discountType === 'fixed') {
      discount = coupon.discountValue;
    }

    // Ensure discount doesn't exceed booking amount
    if (discount > bookingAmount) {
      discount = bookingAmount;
    }

    return Math.round(discount * 100) / 100; // Round to 2 decimals
  }

  /**
   * Apply coupon to booking (called during booking creation)
   */
  async applyCoupon(couponCode, bookingData, session = null) {
    const { email, phone, propertyId, city, bookingAmount, nights, bookingId } = bookingData;

    // Validate again (never trust client)
    const validation = await this.validateCoupon(couponCode, {
      email,
      phone,
      propertyId,
      city,
      bookingAmount,
      nights
    });

    if (!validation.valid) {
      throw new Error(validation.error);
    }

    let coupon;
    if (USE_SUPABASE) {
      coupon = await Coupon.findById(validation.coupon.id);
    } else {
      coupon = await Coupon.findById(validation.coupon.id).session(session);
    }

    // Update coupon usage with atomic operation
    const userIndex = coupon.usedBy?.findIndex(u => 
      u.email === email?.toLowerCase() || u.phone === phone
    ) ?? -1;

    if (!coupon.usedBy) {
      coupon.usedBy = [];
    }

    if (userIndex >= 0) {
      // User exists, increment count
      coupon.usedBy[userIndex].usageCount += 1;
      coupon.usedBy[userIndex].bookingIds.push(bookingId);
      coupon.usedBy[userIndex].lastUsedAt = new Date();
    } else {
      // New user
      coupon.usedBy.push({
        email: email?.toLowerCase(),
        phone,
        usageCount: 1,
        bookingIds: [bookingId],
        lastUsedAt: new Date()
      });
    }

    // Increment total usage
    coupon.currentUsageCount += 1;
    
    if (USE_SUPABASE) {
      await Coupon.save(coupon);
    } else {
      await coupon.save({ session });
    }

    // Create usage record for analytics (only for MongoDB for now)
    if (!USE_SUPABASE) {
      const CouponUsage = MongooseCouponUsage;
      const usage = new CouponUsage({
        couponId: coupon._id,
        couponCode: coupon.code,
        bookingId,
        userEmail: email?.toLowerCase(),
        userPhone: phone,
        originalPrice: bookingAmount,
        discountAmount: validation.discount.amount,
        finalPrice: validation.discount.finalPrice,
        propertyId,
        city,
        nights
      });

      await usage.save({ session });
    }

    return {
      discountAmount: validation.discount.amount,
      finalPrice: validation.discount.finalPrice,
      couponApplied: coupon.code
    };
  }

  /**
   * Get available coupons for a user
   */
  async getAvailableCoupons(email, phone) {
    const now = new Date();
    
    let coupons;
    if (USE_SUPABASE) {
      // For Supabase, we need to handle the query differently
      // Get all active coupons and filter in memory
      const allCoupons = await Coupon.find({
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now }
      });
      
      // Filter based on specific users and excluded users
      coupons = allCoupons.filter(coupon => {
        // Check if specificUsers is empty or includes the user
        const hasSpecificUsers = coupon.specificUsers && coupon.specificUsers.length > 0;
        const isSpecificUser = hasSpecificUsers && coupon.specificUsers.some(user => 
          user === email?.toLowerCase() || user === phone
        );
        
        // Check if user is excluded
        const isExcluded = coupon.excludedUsers && coupon.excludedUsers.some(user => 
          user === email?.toLowerCase() || user === phone
        );
        
        // Include if: (no specific users OR is specific user) AND not excluded
        return (!hasSpecificUsers || isSpecificUser) && !isExcluded;
      });
      
      // Map to return only needed fields
      coupons = coupons.map(c => ({
        code: c.code,
        description: c.description,
        discountType: c.discountType,
        discountValue: c.discountValue,
        maxDiscountAmount: c.maxDiscountAmount,
        validUntil: c.validUntil,
        minBookingAmount: c.minBookingAmount
      }));
    } else {
      coupons = await Coupon.find({
        isActive: true,
        validFrom: { $lte: now },
        validUntil: { $gte: now },
        $or: [
          { specificUsers: { $size: 0 } },
          { specificUsers: email?.toLowerCase() },
          { specificUsers: phone }
        ],
        excludedUsers: { 
          $nin: [email?.toLowerCase(), phone] 
        }
      }).select('code description discountType discountValue maxDiscountAmount validUntil minBookingAmount');
    }

    return coupons;
  }
}

module.exports = new CouponService();
