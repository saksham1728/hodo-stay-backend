const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // Booking References
  bookingReference: {
    type: String,
    required: false, // Will be auto-generated in pre-save hook
    unique: true,
    index: true
  },
  ruReservationId: {
    type: String,
    index: true
  },

  // User reference (optional for now - guest checkout)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
  },

  // Property References
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
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
    required: true,
    index: true
  },

  // Booking Dates
  checkIn: {
    type: Date,
    required: true,
    index: true
  },
  checkOut: {
    type: Date,
    required: true,
    index: true
  },
  nights: {
    type: Number,
    required: true
  },

  // Guest Information (as per RU API requirements)
  guestInfo: {
    name: {
      type: String,
      required: true,
      maxlength: 20
    },
    surname: {
      type: String,
      required: true,
      maxlength: 30
    },
    email: {
      type: String,
      required: true,
      maxlength: 100,
      index: true
    },
    phone: {
      type: String,
      required: true,
      maxlength: 30
    },
    address: {
      type: String,
      maxlength: 50
    },
    zipCode: {
      type: String,
      maxlength: 15
    }
  },

  // Guest Details
  numberOfGuests: {
    type: Number,
    required: true,
    min: 1
  },
  numberOfAdults: {
    type: Number,
    default: 1
  },
  numberOfChildren: {
    type: Number,
    default: 0
  },
  numberOfInfants: {
    type: Number,
    default: 0
  },

  // Pricing Information
  pricing: {
    ruPrice: {
      type: Number,
      required: true
    },
    clientPrice: {
      type: Number,
      required: true
    },
    alreadyPaid: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'INR'
    }
  },

  // Payment Information
  payment: {
    paymentId: String,
    orderId: String,
    signature: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    method: String,
    paidAt: Date
  },

  // Booking Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending',
    index: true
  },
  ruStatus: String,

  // Booking Source (where the booking came from)
  bookingSource: {
    type: String,
    enum: ['direct', 'airbnb', 'booking.com', 'expedia', 'vrbo', 'external', 'other', 'unknown'],
    default: 'direct',
    index: true
  },

  // Cancellation Info
  cancellation: {
    cancelledAt: Date,
    cancelledBy: {
      type: String,
      enum: ['guest', 'admin', 'system']
    },
    reason: String,
    refundAmount: Number,
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'failed']
    }
  },

  // Special Requests
  specialRequests: {
    type: String,
    maxlength: 500
  },

  // Access Token for guest booking management (without login)
  accessToken: {
    type: String,
    required: false, // Will be auto-generated in pre-save hook
    unique: true,
    index: true
  },
  tokenExpiresAt: {
    type: Date,
    required: false, // Will be auto-generated in pre-save hook
    index: true
  }
}, {
  timestamps: true
});

// Generate booking reference and access token before saving
bookingSchema.pre('save', function(next) {
  // Generate booking reference if not exists
  if (!this.bookingReference) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    this.bookingReference = `HODO-${dateStr}-${random}`;
  }
  
  // Generate secure access token if not exists
  if (!this.accessToken) {
    const crypto = require('crypto');
    this.accessToken = crypto.randomBytes(32).toString('hex');
  }
  
  // Set token expiration (90 days from creation) if not exists
  if (!this.tokenExpiresAt) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 90);
    this.tokenExpiresAt = expiryDate;
  }
  
  next();
});

// Indexes for faster queries
bookingSchema.index({ userId: 1, status: 1 });
bookingSchema.index({ 'guestInfo.email': 1 });
bookingSchema.index({ 'payment.orderId': 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ accessToken: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
