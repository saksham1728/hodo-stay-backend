const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // Booking reference
  bookingReference: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Property references
  buildingId: {
    type: String,
    required: true,
    index: true
  },
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: true,
    index: true
  },
  ruPropertyId: {
    type: Number,
    required: true
  },

  // Booking dates
  checkInDate: {
    type: Date,
    required: true,
    index: true
  },
  checkOutDate: {
    type: Date,
    required: true,
    index: true
  },

  // Guest details
  guests: {
    adults: {
      type: Number,
      required: true,
      min: 1
    },
    children: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      required: true
    }
  },

  // Pricing breakdown
  pricing: {
    basePrice: {
      type: Number,
      required: true
    },
    nights: {
      type: Number,
      required: true
    },
    subtotal: {
      type: Number,
      required: true
    },
    taxes: {
      type: Number,
      default: 0
    },
    fees: {
      cleaningFee: {
        type: Number,
        default: 0
      },
      serviceFee: {
        type: Number,
        default: 0
      }
    },
    totalAmount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },

  // Payment details
  payment: {
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    method: String,
    transactionId: String,
    paidAt: Date
  },

  // Booking status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no-show'],
    default: 'pending',
    index: true
  },

  // Guest information
  guestInfo: {
    primaryGuest: {
      firstName: String,
      lastName: String,
      email: String,
      phone: String
    },
    specialRequests: String,
    arrivalTime: String
  },

  // Rentals United booking reference (if pushed to RU)
  ruBookingId: String,

  // Cancellation details
  cancellation: {
    cancelledAt: Date,
    cancelledBy: String,
    reason: String,
    refundAmount: Number
  },

  // Notes and communication
  notes: [{
    message: String,
    addedBy: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for better performance
bookingSchema.index({ checkInDate: 1, checkOutDate: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });
bookingSchema.index({ 'payment.status': 1 });

// Virtual for booking duration
bookingSchema.virtual('duration').get(function () {
  const diffTime = Math.abs(this.checkOutDate - this.checkInDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Generate booking reference
bookingSchema.pre('save', function (next) {
  if (!this.bookingReference) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.bookingReference = `HS-${timestamp}-${random}`.toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);