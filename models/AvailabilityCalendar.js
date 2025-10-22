const mongoose = require('mongoose');

const availabilityCalendarSchema = new mongoose.Schema({
  // Property Reference
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  ruPropertyId: {
    type: Number,
    required: true,
    index: true
  },
  
  // Date Information
  date: {
    type: Date,
    required: true,
    index: true
  },
  
  // Availability Status
  isAvailable: {
    type: Boolean,
    default: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  
  // Booking Information
  isBooked: {
    type: Boolean,
    default: false
  },
  bookingSource: {
    type: String,
    enum: ['direct', 'airbnb', 'booking.com', 'other'],
    default: 'direct'
  },
  
  // Pricing for the date
  pricing: {
    basePrice: Number,
    currency: {
      type: String,
      default: 'USD'
    },
    minStay: {
      type: Number,
      default: 1
    },
    maxStay: Number
  },
  
  // Restrictions
  restrictions: {
    checkInAllowed: {
      type: Boolean,
      default: true
    },
    checkOutAllowed: {
      type: Boolean,
      default: true
    },
    minStayRequired: Number,
    maxStayAllowed: Number
  },
  
  // Sync Information
  lastSyncedAt: {
    type: Date,
    default: Date.now
  },
  syncSource: {
    type: String,
    enum: ['rentals_united', 'manual', 'booking_system'],
    default: 'rentals_united'
  },
  
  // Reservation Details (if booked)
  reservationDetails: {
    reservationId: String,
    ruReservationId: String,
    guestName: String,
    checkIn: Date,
    checkOut: Date,
    numberOfGuests: Number
  }
}, {
  timestamps: true
});

// Compound indexes for better performance
availabilityCalendarSchema.index({ ruPropertyId: 1, date: 1 }, { unique: true });
availabilityCalendarSchema.index({ property: 1, date: 1 });
availabilityCalendarSchema.index({ date: 1, isAvailable: 1 });
availabilityCalendarSchema.index({ isBooked: 1, bookingSource: 1 });
availabilityCalendarSchema.index({ lastSyncedAt: 1 });

// Static method to get availability for date range
availabilityCalendarSchema.statics.getAvailabilityRange = function(propertyId, startDate, endDate) {
  return this.find({
    $or: [
      { ruPropertyId: propertyId },
      { property: propertyId }
    ],
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: 1 });
};

// Static method to check if dates are available
availabilityCalendarSchema.statics.checkAvailability = function(propertyId, checkIn, checkOut) {
  return this.find({
    $or: [
      { ruPropertyId: propertyId },
      { property: propertyId }
    ],
    date: {
      $gte: checkIn,
      $lt: checkOut
    },
    $or: [
      { isAvailable: false },
      { isBlocked: true },
      { isBooked: true }
    ]
  });
};

// Static method to block dates
availabilityCalendarSchema.statics.blockDates = function(propertyId, startDate, endDate, reason = 'manual') {
  const dates = [];
  const currentDate = new Date(startDate);
  
  while (currentDate < endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return this.bulkWrite(
    dates.map(date => ({
      updateOne: {
        filter: {
          $or: [
            { ruPropertyId: propertyId },
            { property: propertyId }
          ],
          date: date
        },
        update: {
          $set: {
            isAvailable: false,
            isBlocked: true,
            syncSource: reason,
            lastSyncedAt: new Date()
          }
        },
        upsert: true
      }
    }))
  );
};

// Static method to unblock dates
availabilityCalendarSchema.statics.unblockDates = function(propertyId, startDate, endDate) {
  return this.updateMany({
    $or: [
      { ruPropertyId: propertyId },
      { property: propertyId }
    ],
    date: {
      $gte: startDate,
      $lt: endDate
    }
  }, {
    $set: {
      isAvailable: true,
      isBlocked: false,
      isBooked: false,
      lastSyncedAt: new Date()
    },
    $unset: {
      reservationDetails: 1
    }
  });
};

module.exports = mongoose.model('AvailabilityCalendar', availabilityCalendarSchema);