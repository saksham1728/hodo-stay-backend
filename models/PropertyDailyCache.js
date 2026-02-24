const mongoose = require('mongoose');

const propertyDailyCacheSchema = new mongoose.Schema({
  // Identifiers
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: true,
    index: true
  },
  ruPropertyId: {
    type: String,
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  
  // Availability
  isAvailable: {
    type: Boolean,
    required: true,
    default: false,
    index: true
  },
  
  // Pricing
  pricePerNight: {
    type: Number,
    required: true,
    default: 0
  },
  
  // Metadata
  lastSynced: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound unique index to prevent duplicate records
propertyDailyCacheSchema.index({ unitId: 1, date: 1 }, { unique: true });

// Query optimization index
propertyDailyCacheSchema.index({ date: 1, isAvailable: 1 });

// TTL index - auto-delete records older than 180 days
propertyDailyCacheSchema.index({ date: 1 }, { expireAfterSeconds: 15552000 }); // 180 days in seconds

const PropertyDailyCache = mongoose.model('PropertyDailyCache', propertyDailyCacheSchema);

module.exports = PropertyDailyCache;
