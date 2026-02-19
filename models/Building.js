const mongoose = require('mongoose');

// Sub-schemas for nested structures
const propertyImageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  url: { type: String, required: true },
  altText: String,
  type: {
    type: String,
    enum: ['bedroom', 'living', 'kitchen', 'bathroom', 'exterior', 'common', 'other'],
    default: 'other'
  },
  order: Number
}, { _id: false });

const amenitySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  icon: String,
  category: {
    type: String,
    enum: ['general', 'kitchen', 'bathroom', 'safety', 'parking', 'entertainment']
  }
}, { _id: false });

const nearbyItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  distance: String,
  travelTime: String,
  type: {
    type: String,
    enum: ['metro', 'bus', 'airport', 'restaurant', 'hospital', 'techpark', 'landmark']
  }
}, { _id: false });

const accessibilitySchema = new mongoose.Schema({
  walkScore: String,
  nearbyTransit: [nearbyItemSchema],
  nearbyPlaces: [nearbyItemSchema],
  neighbourhoodHighlights: [String]
}, { _id: false });

const checkInPolicySchema = new mongoose.Schema({
  time: { type: String, required: true },
  earlyCheckInAllowed: Boolean,
  earlyCheckInNote: String
}, { _id: false });

const checkOutPolicySchema = new mongoose.Schema({
  time: { type: String, required: true },
  lateCheckOutAllowed: Boolean,
  lateCheckOutNote: String
}, { _id: false });

const housekeepingPolicySchema = new mongoose.Schema({
  frequency: {
    type: String,
    enum: ['daily', 'alternate_day', 'weekly', 'on_request'],
    required: true
  },
  linenChange: String,
  towelChange: String,
  additionalCleaningCharge: Number
}, { _id: false });

const longStayPolicySchema = new mongoose.Schema({
  minimumNights: Number,
  monthlyDiscountPercentage: Number,
  customPricingAvailable: Boolean,
  notes: String
}, { _id: false });

const cancellationPolicySchema = new mongoose.Schema({
  policyType: {
    type: String,
    enum: ['flexible', 'moderate', 'strict', 'non_refundable'],
    required: true
  },
  freeCancellationBeforeHours: Number,
  partialRefundBeforeHours: Number,
  notes: String
}, { _id: false });

const paymentPolicySchema = new mongoose.Schema({
  acceptedMethods: [{
    type: String,
    enum: ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet', 'bank_transfer', 'cash']
  }],
  securityDepositRequired: Boolean,
  securityDepositAmount: Number,
  securityDepositRefundPolicy: String
}, { _id: false });

const propertyPoliciesSchema = new mongoose.Schema({
  checkIn: [checkInPolicySchema],
  checkOut: [checkOutPolicySchema],
  housekeeping: [housekeepingPolicySchema],
  longStay: [longStayPolicySchema],
  cancellation: [cancellationPolicySchema],
  payments: paymentPolicySchema,
  otherRules: [String]
}, { _id: false });

const ratingBreakdownSchema = new mongoose.Schema({
  fiveStar: { type: Number, default: 0 },
  fourStar: { type: Number, default: 0 },
  threeStar: { type: Number, default: 0 },
  twoStar: { type: Number, default: 0 },
  oneStar: { type: Number, default: 0 }
}, { _id: false });

const reviewSummarySchema = new mongoose.Schema({
  averageRating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  ratingBreakdown: ratingBreakdownSchema
}, { _id: false });

const reviewSchema = new mongoose.Schema({
  id: { type: String, required: true },
  userName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: String,
  comment: { type: String, required: true },
  date: { type: String, required: true },
  avatarUrl: String,
  isVerified: { type: Boolean, default: false }
}, { _id: false });

const roomTypeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: String,
  maxGuests: { type: Number, required: true },
  bedrooms: { type: Number, required: true },
  bathrooms: { type: Number, required: true },
  sizeSqft: Number,
  defaultPrice: Number,
  mappedRentalIds: [String]
}, { _id: false });

const propertySEOSchema = new mongoose.Schema({
  metaTitle: { type: String, required: true },
  metaDescription: { type: String, required: true },
  keywords: [String],
  ogImage: String,
  canonicalUrl: String
}, { _id: false });

const propertyLocationSchema = new mongoose.Schema({
  addressLine1: { type: String, required: true },
  addressLine2: String,
  area: String,
  city: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  pincode: String,
  latitude: Number,
  longitude: Number
}, { _id: false });

// Main Building Schema
const buildingSchema = new mongoose.Schema({
  // Core identifiers
  slug: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  
  // Basic property info
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  title: {
    type: String,
    trim: true
  },
  
  subTitle: {
    type: String,
    trim: true
  },
  
  description: {
    type: String,
    trim: true
  },
  
  // Location (enhanced structure)
  location: {
    type: propertyLocationSchema,
    default: () => ({})
  },
  
  // Legacy location fields (for backward compatibility)
  legacyLocation: {
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Media
  heroImage: String,
  
  gallery: [propertyImageSchema],
  
  // Legacy images (for backward compatibility)
  images: [{
    url: String,
    caption: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  // Highlights
  highlights: [String],
  
  // Amenities (enhanced structure)
  amenities: [amenitySchema],
  
  // Legacy amenities (for backward compatibility)
  legacyAmenities: [String],
  
  // Accessibility
  accessibility: [accessibilitySchema],
  
  // Policies
  policies: [propertyPoliciesSchema],
  
  // Reviews
  reviewSummary: [reviewSummarySchema],
  reviews: [reviewSchema],
  
  // Room Types
  roomTypes: [roomTypeSchema],
  
  // SEO
  seo: propertySEOSchema,
  
  // Building details
  totalUnits: {
    type: Number,
    default: 0
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Virtual for backward compatibility - map title to name if title exists
buildingSchema.virtual('displayName').get(function() {
  return this.title || this.name;
});

// Pre-save hook to generate slug if not provided
buildingSchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  
  // Sync legacy location with new location structure if needed
  if (this.legacyLocation && this.legacyLocation.city && !this.location.city) {
    this.location = {
      addressLine1: this.legacyLocation.address || '',
      city: this.legacyLocation.city || '',
      state: this.legacyLocation.state || '',
      country: this.legacyLocation.country || '',
      pincode: this.legacyLocation.zipCode || '',
      latitude: this.legacyLocation.coordinates?.latitude,
      longitude: this.legacyLocation.coordinates?.longitude
    };
  }
  
  // Set default SEO if not provided
  if (!this.seo) {
    this.seo = {
      metaTitle: this.title || this.name,
      metaDescription: this.description || `Book your stay at ${this.name}`
    };
  }
  
  next();
});

// Indexes for better performance
buildingSchema.index({ isActive: 1 });
buildingSchema.index({ slug: 1 });
buildingSchema.index({ 'location.city': 1 });
buildingSchema.index({ 'location.state': 1 });
buildingSchema.index({ 'legacyLocation.city': 1 });

module.exports = mongoose.model('Building', buildingSchema);