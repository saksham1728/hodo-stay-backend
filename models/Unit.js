const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema({
  // Rentals United identifiers
  ruPropertyId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  ruOwnerID: {
    type: Number,
    required: true
  },

  // Building reference
  buildingId: {
    type: String,
    required: true,
    index: true
  },

  // Unit details
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },

  // Unit specifications
  space: Number, // Square meters
  standardGuests: {
    type: Number,
    default: 1
  },
  canSleepMax: {
    type: Number,
    default: 1
  },
  noOfUnits: {
    type: Number,
    default: 1
  },
  floor: Number,

  // Property type
  propertyType: {
    propertyTypeID: Number,
    objectTypeID: Number
  },

  // Pricing
  pricing: {
    deposit: {
      type: Number,
      default: 0
    },
    securityDeposit: {
      type: Number,
      default: 0
    }
  },

  // Check-in/out details
  checkInOut: {
    checkInFrom: String,
    checkInTo: String,
    checkOutUntil: String,
    place: String
  },

  // Images
  images: [{
    imageTypeID: Number,
    imageReferenceID: Number,
    url: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],

  // Amenities
  amenities: [{
    amenityID: Number,
    count: {
      type: Number,
      default: 1
    }
  }],

  // Composition rooms
  compositionRooms: [{
    compositionRoomID: Number,
    count: Number
  }],

  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },

  // Sync info
  lastSyncedAt: {
    type: Date,
    default: Date.now
  },
  ruLastMod: Date
}, {
  timestamps: true
});

// Indexes for better performance
unitSchema.index({ buildingId: 1 });
unitSchema.index({ isActive: 1, isArchived: 1 });
unitSchema.index({ 'location.detailedLocationID': 1 });

// Virtual for primary image
unitSchema.virtual('primaryImage').get(function () {
  return this.images.find(img => img.isPrimary) || this.images[0];
});

module.exports = mongoose.model('Unit', unitSchema);