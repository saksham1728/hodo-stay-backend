const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  // Rentals United Property Data
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
  
  // Basic Property Info
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  
  // Location Details
  location: {
    detailedLocationID: Number,
    street: String,
    zipCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Property Details
  propertyType: {
    propertyTypeID: Number,
    objectTypeID: Number
  },
  capacity: {
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
    }
  },
  
  // Pricing Info
  pricing: {
    cleaningPrice: {
      type: Number,
      default: 0
    },
    deposit: {
      type: Number,
      default: 0
    },
    securityDeposit: {
      type: Number,
      default: 0
    }
  },
  
  // Check-in/out Details
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
  
  // Composition Rooms
  compositionRooms: [{
    compositionRoomID: Number,
    amenities: [{
      amenityID: Number,
      count: Number
    }]
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
  
  // Sync Info
  lastSyncedAt: {
    type: Date,
    default: Date.now
  },
  ruLastMod: Date,
  
  // Platform specific
  featured: {
    type: Boolean,
    default: false
  },
  tags: [String]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
propertySchema.index({ 'location.detailedLocationID': 1 });
propertySchema.index({ isActive: 1, isArchived: 1 });
propertySchema.index({ featured: 1 });
propertySchema.index({ lastSyncedAt: 1 });

// Virtual for primary image
propertySchema.virtual('primaryImage').get(function() {
  return this.images.find(img => img.isPrimary) || this.images[0];
});

// Virtual for guest capacity display
propertySchema.virtual('guestCapacity').get(function() {
  return `${this.capacity.standardGuests}-${this.capacity.canSleepMax} guests`;
});

module.exports = mongoose.model('Property', propertySchema);