const mongoose = require('mongoose');

const couponUsageSchema = new mongoose.Schema({
  couponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    required: true,
    index: true
  },
  couponCode: {
    type: String,
    required: true,
    uppercase: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  
  // User Information
  userEmail: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  userPhone: {
    type: String,
    required: true,
    index: true
  },
  
  // Pricing Details
  originalPrice: {
    type: Number,
    required: true
  },
  discountAmount: {
    type: Number,
    required: true
  },
  finalPrice: {
    type: Number,
    required: true
  },
  
  // Property Details
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building'
  },
  propertyName: String,
  city: String,
  
  // Booking Details
  checkIn: Date,
  checkOut: Date,
  nights: Number,
  
  // Metadata
  appliedAt: {
    type: Date,
    default: Date.now
  },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

// Compound indexes for analytics
couponUsageSchema.index({ couponId: 1, appliedAt: -1 });
couponUsageSchema.index({ userEmail: 1, appliedAt: -1 });
couponUsageSchema.index({ propertyId: 1, appliedAt: -1 });

module.exports = mongoose.model('CouponUsage', couponUsageSchema);
