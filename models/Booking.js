const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // Booking Reference
  bookingReference: {
    type: String,
    unique: true,
    required: true
  },

  // Rentals United Integration
  ruReservationId: {
    type: String,
    sparse: true, // Allow null but unique if present
    index: true
  },

  // Property & User References
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  ruPropertyId: {
    type: Number,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Guest Information
  guestInfo: {
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    numberOfGuests: {
      type: Number,
      required: true,
      min: 1
    },
    specialRequests: String
  },

  // Booking Dates
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: {
    type: Date,
    required: true
  },
  nights: {
    type: Number,
    required: true
  },

  // Pricing Details
  pricing: {
    basePrice: {
      type: Number,
      required: true
    },
    cleaningFee: {
      type: Number,
      default: 0
    },
    serviceFee: {
      type: Number,
      default: 0
    },
    taxes: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    },

    // Rentals United Pricing
    ruPrice: Number,
    clientPrice: Number,
    alreadyPaid: {
      type: Number,
      default: 0
    }
  },

  // Booking Status
  status: {
    type: String,
    enum: [
      'pending',           // Just created, awaiting payment
      'payment_pending',   // Payment initiated
      'confirmed',         // Payment successful, sent to RU
      'ru_confirmed',      // Confirmed in Rentals United
      'checked_in',        // Guest checked in
      'checked_out',       // Guest checked out
      'cancelled',         // Booking cancelled
      'refunded'          // Booking refunded
    ],
    default: 'pending'
  },

  // Payment Information
  payment: {
    paymentId: String,           // Payment gateway ID
    paymentMethod: String,       // card, upi, wallet, etc.
    paymentStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionId: String,
    paidAt: Date,
    refundId: String,
    refundedAt: Date,
    refundAmount: Number
  },

  // Cancellation Details
  cancellation: {
    cancelledAt: Date,
    cancelledBy: {
      type: String,
      enum: ['guest', 'host', 'admin', 'system']
    },
    reason: String,
    refundAmount: Number,
    cancellationFee: Number
  },

  // Communication
  messages: [{
    from: {
      type: String,
      enum: ['guest', 'host', 'admin']
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    isRead: {
      type: Boolean,
      default: false
    }
  }],

  // Sync Information
  syncStatus: {
    lastSyncedAt: Date,
    syncAttempts: {
      type: Number,
      default: 0
    },
    lastSyncError: String,
    needsSync: {
      type: Boolean,
      default: false
    }
  },

  // Review & Rating (after checkout)
  review: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    reviewedAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
bookingSchema.index({ bookingReference: 1 });
bookingSchema.index({ ruReservationId: 1 });
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ property: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ 'payment.paymentStatus': 1 });
bookingSchema.index({ 'syncStatus.needsSync': 1 });

// Virtual for booking duration
bookingSchema.virtual('duration').get(function () {
  if (this.checkIn && this.checkOut) {
    const diffTime = Math.abs(this.checkOut - this.checkIn);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Generate unique booking reference
bookingSchema.pre('save', function (next) {
  if (!this.bookingReference) {
    this.bookingReference = 'HS' + Date.now() + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Calculate nights
  if (this.checkIn && this.checkOut) {
    const diffTime = Math.abs(this.checkOut - this.checkIn);
    this.nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  next();
});

// Static method to find bookings by date range
bookingSchema.statics.findByDateRange = function (propertyId, startDate, endDate) {
  return this.find({
    $or: [
      { ruPropertyId: propertyId },
      { property: propertyId }
    ],
    status: { $in: ['confirmed', 'ru_confirmed', 'checked_in'] },
    $or: [
      {
        checkIn: { $gte: startDate, $lt: endDate }
      },
      {
        checkOut: { $gt: startDate, $lte: endDate }
      },
      {
        checkIn: { $lte: startDate },
        checkOut: { $gte: endDate }
      }
    ]
  });
};

module.exports = mongoose.model('Booking', bookingSchema);