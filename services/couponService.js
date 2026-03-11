const Coupon = require('../models/Coupon');
const Booking = require('../models/Booking');
const CouponUsage = require('../models/CouponUsage');

class CouponService {
  /**
   * Validate coupon and calculate discount
   */
  async validateCoupon(couponCode, bookingData) {
    const { email, phone, propertyId, city, bookingAmount, nights } = bookingData;

    // 1. Find coupon
    const coupon = await Coupon.findValidCoupon(couponCode);
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
    if (coupon.isExpired) {
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
      const existingBookings = await Booking.countDocuments({
        $or: [
          { 'guestInfo.email': email?.toLowerCase() },
          { 'guestInfo.phone': phone }
        ],
        status: { $in: ['confirmed', 'completed'] }
      });

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
      const userUsage = coupon.getUserUsage(email, phone);
      if (userUsage >= coupon.maxUsagePerUser) {
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
        error: `Minimum booking amount of $${coupon.minBookingAmount} required`
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
        id: coupon._id,
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

    const coupon = await Coupon.findById(validation.coupon.id).session(session);

    // Update coupon usage with atomic operation
    const userIndex = coupon.usedBy.findIndex(u => 
      u.email === email?.toLowerCase() || u.phone === phone
    );

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
    await coupon.save({ session });

    // Create usage record for analytics
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
    
    const coupons = await Coupon.find({
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

    return coupons;
  }
}

module.exports = new CouponService();
