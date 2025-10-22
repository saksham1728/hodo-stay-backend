const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema({
  // Sync Operation Details
  syncType: {
    type: String,
    enum: [
      'properties_sync',
      'reservations_sync', 
      'availability_sync',
      'pricing_sync',
      'manual_sync'
    ],
    required: true
  },
  
  // Sync Status
  status: {
    type: String,
    enum: ['started', 'in_progress', 'completed', 'failed', 'partial'],
    default: 'started'
  },
  
  // Timing
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  duration: Number, // in milliseconds
  
  // Sync Details
  details: {
    totalRecords: {
      type: Number,
      default: 0
    },
    processedRecords: {
      type: Number,
      default: 0
    },
    successfulRecords: {
      type: Number,
      default: 0
    },
    failedRecords: {
      type: Number,
      default: 0
    },
    newRecords: {
      type: Number,
      default: 0
    },
    updatedRecords: {
      type: Number,
      default: 0
    }
  },
  
  // API Call Information
  apiCalls: {
    totalCalls: {
      type: Number,
      default: 0
    },
    successfulCalls: {
      type: Number,
      default: 0
    },
    failedCalls: {
      type: Number,
      default: 0
    },
    rateLimitHits: {
      type: Number,
      default: 0
    }
  },
  
  // Error Information
  syncErrors: [{
    errorType: String,
    errorMessage: String,
    errorCode: String,
    recordId: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    stackTrace: String
  }],
  
  // Warnings
  warnings: [{
    warningType: String,
    warningMessage: String,
    recordId: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Sync Configuration
  config: {
    dateFrom: Date,
    dateTo: Date,
    locationId: Number,
    propertyIds: [Number],
    forceSync: {
      type: Boolean,
      default: false
    }
  },
  
  // Results Summary
  summary: {
    propertiesProcessed: Number,
    reservationsProcessed: Number,
    availabilityDatesProcessed: Number,
    conflictsFound: Number,
    conflictsResolved: Number
  },
  
  // Triggered By
  triggeredBy: {
    type: String,
    enum: ['cron_job', 'manual', 'webhook', 'api_call', 'system'],
    default: 'system'
  },
  triggeredByUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Next Sync Information
  nextSyncScheduled: Date,
  
  // Performance Metrics
  performance: {
    memoryUsage: {
      heapUsed: Number,
      heapTotal: Number,
      external: Number
    },
    cpuUsage: Number,
    networkLatency: Number
  }
}, {
  timestamps: true
});

// Indexes for better performance
syncLogSchema.index({ syncType: 1, status: 1 });
syncLogSchema.index({ startedAt: -1 });
syncLogSchema.index({ status: 1, completedAt: -1 });
syncLogSchema.index({ triggeredBy: 1 });

// Pre-save middleware to calculate duration
syncLogSchema.pre('save', function(next) {
  if (this.completedAt && this.startedAt) {
    this.duration = this.completedAt - this.startedAt;
  }
  next();
});

// Static method to get latest sync by type
syncLogSchema.statics.getLatestSync = function(syncType) {
  return this.findOne({ syncType })
    .sort({ startedAt: -1 })
    .exec();
};

// Static method to get sync statistics
syncLogSchema.statics.getSyncStats = function(days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        startedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$syncType',
        totalSyncs: { $sum: 1 },
        successfulSyncs: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
          }
        },
        failedSyncs: {
          $sum: {
            $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
          }
        },
        avgDuration: { $avg: '$duration' },
        totalRecordsProcessed: { $sum: '$details.processedRecords' },
        totalApiCalls: { $sum: '$apiCalls.totalCalls' },
        lastSync: { $max: '$startedAt' }
      }
    }
  ]);
};

// Instance method to mark as completed
syncLogSchema.methods.markCompleted = function(summary = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.duration = this.completedAt - this.startedAt;
  
  if (summary) {
    this.summary = { ...this.summary, ...summary };
  }
  
  return this.save();
};

// Instance method to mark as failed
syncLogSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.completedAt = new Date();
  this.duration = this.completedAt - this.startedAt;
  
  if (error) {
    this.errors.push({
      errorType: 'sync_failure',
      errorMessage: error.message || error,
      errorCode: error.code,
      stackTrace: error.stack
    });
  }
  
  return this.save();
};

// Instance method to add error
syncLogSchema.methods.addError = function(errorType, errorMessage, recordId = null, errorCode = null) {
  this.syncErrors.push({
    errorType,
    errorMessage,
    errorCode,
    recordId,
    timestamp: new Date()
  });
  
  this.details.failedRecords += 1;
  return this.save();
};

// Instance method to add warning
syncLogSchema.methods.addWarning = function(warningType, warningMessage, recordId = null) {
  this.warnings.push({
    warningType,
    warningMessage,
    recordId,
    timestamp: new Date()
  });
  
  return this.save();
};

module.exports = mongoose.model('SyncLog', syncLogSchema);