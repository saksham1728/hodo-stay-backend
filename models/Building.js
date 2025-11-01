const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema({
  // Basic building info
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Description
  description: {
    type: String,
    trim: true
  },
  
  // Location details
  location: {
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
  
  // Images
  images: [{
    url: String,
    caption: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  
  // Amenities
  amenities: [String],
  
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

// Indexes for better performance
buildingSchema.index({ isActive: 1 });
buildingSchema.index({ 'location.city': 1 });

module.exports = mongoose.model('Building', buildingSchema);