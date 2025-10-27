const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema({
  // Building identifier from Rentals United
  buildingId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Basic building info
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Location details
  location: {
    detailedLocationID: {
      type: Number,
      required: true,
      index: true
    },
    street: String,
    zipCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Building details
  totalUnits: {
    type: Number,
    default: 0
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Sync info
  lastSyncedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
buildingSchema.index({ 'location.detailedLocationID': 1 });
buildingSchema.index({ isActive: 1 });

module.exports = mongoose.model('Building', buildingSchema);