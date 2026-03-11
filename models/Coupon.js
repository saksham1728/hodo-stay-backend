const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  // Basic Information
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Discount Configuration
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  maxDiscountAmount: {
    type: Number,
    default: null // Only for percentage discounts
  },
  
  // Usage Restrictions
  usageType: {
    type: String,
    enum: ['unlimited', 'limited_total', 'limited_per_user'],
    required: true,
    default: 'unlimited'
  },
  maxTotalUsage: {
    type: Number,
    default: null // For limited_total
  },
  maxUsagePerUser: {
    type: Number,
    default: 1 // For limited_per_user
  },
  currentUsageCount: {
    type: Number,
    default: 0
  },
  
  // Track who used it
  usedBy: [{
    email: String,
    phone: String,
    usageCount: { type: Number, default: 0 },
    bookingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
    lastUsedAt: Date
  }],
  
  // User Eligibility
  newUsersOnly: {
    type: Boolean,
    default: false
  },
  specificUsers: [{
    type: String, // email or phone
    lowercase: true
  }],
  excludedUsers: [{
    type: String, // email or phone
    lowercase: true
  }],
  
  // Scope Restrictions
  applicableOn: {
    type: String,
    enum: ['all', 'property', 'city'],
    default: 'all'
  },
  properties: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building'
  }],
  cities: [{
    type: String,
    lowercase: true
  }],
  
  // Validity Period
  validFrom: {
    type: Date,
    required: true,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  
  // Minimum Requirements
  minBookingAmount: {
    type: Number,
    default: 0
  },
  minNights: {
    type: Number,
    default: 1
  },
  
  // Metadata
  createdBy: {
    type: String,
    default: 'admin'
  },
  notes: String
}, {
  timestamps: true
});

// Indexes for performance
couponSchema.index({ code: 1, isActive: 1 });
couponSchema.index({ validFrom: 1, validUntil: 1 });
couponSchema.index({ 'usedBy.email': 1 });
couponSchema.index({ 'usedBy.phone': 1 });

// Virtual to check if expired
couponSchema.virtual('isExpired').get(function() {
  const now = new Date();
  return now < this.validFrom || now > this.validUntil;
});

// Method to check if user has used this coupon
couponSchema.methods.getUserUsage = function(email, phone) {
  const userUsage = this.usedBy.find(u => 
    u.email === email?.toLowerCase() || u.phone === phone
  );
  return userUsage ? userUsage.usageCount : 0;
};

// Method to check if coupon is available
couponSchema.methods.isAvailable = function() {
  if (!this.isActive) return false;
  if (this.isExpired) return false;
  
  if (this.usageType === 'limited_total') {
    return this.currentUsageCount < this.maxTotalUsage;
  }
  
  return true;
};

// Static method to find valid coupon
couponSchema.statics.findValidCoupon = async function(code) {
  const now = new Date();
  return this.findOne({
    code: code.toUpperCase(),
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now }
  });
};

module.exports = mongoose.model('Coupon', couponSchema);
