const { Booking, Property, User, AvailabilityCalendar, SyncLog } = require('../models');
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

class BookingController {
  // Get user's bookings
  async getUserBookings(req, res) {
    try {
      const { userId } = req.params;
      const { status, page = 1, limit = 10 } = req.query;

      const query = { user: userId };
      if (status) {
        query.status = status;
      }

      const skip = (page - 1) * limit;

      const bookings = await Booking.find(query)
        .populate('property', 'name images location')
        .populate('user', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const totalBookings = await Booking.countDocuments(query);

      res.json({
        success: true,
        data: {
          bookings,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalBookings / limit),
            totalBookings,
            hasNext: page * limit < totalBookings,
            hasPrev: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Error in getUserBookings:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get all reservations (admin)
  async getAllReservations(req, res) {
    try {
      const {
        status,
        propertyId,
        dateFrom,
        dateTo,
        page = 1,
        limit = 20
      } = req.query;

      const query = {};

      if (status) query.status = status;
      if (propertyId) query.ruPropertyId = parseInt(propertyId);

      if (dateFrom || dateTo) {
        query.$or = [];
        if (dateFrom) query.$or.push({ checkIn: { $gte: new Date(dateFrom) } });
        if (dateTo) query.$or.push({ checkOut: { $lte: new Date(dateTo) } });
      }

      const skip = (page - 1) * limit;

      const reservations = await Booking.find(query)
        .populate('property', 'name images location')
        .populate('user', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const totalReservations = await Booking.countDocuments(query);

      res.json({
        success: true,
        data: {
          reservations,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalReservations / limit),
            totalReservations,
            hasNext: page * limit < totalReservations,
            hasPrev: page > 1
          }
        }
      });

    } catch (error) {
      console.error('Error in getAllReservations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Create a new booking
  async createBooking(req, res) {
    try {
      const {
        propertyId,
        userId,
        checkIn,
        checkOut,
        numberOfGuests,
        guestInfo,
        specialRequests = ''
      } = req.body;

      // Validate required fields
      if (!propertyId || !userId || !checkIn || !checkOut || !numberOfGuests || !guestInfo) {
        return res.status(400).json({
          success: false,
          message: 'Missing required booking information'
        });
      }

      console.log(`Creating booking for property ${propertyId}: ${checkIn} to ${checkOut}`);

      // Check if property exists
      let query = {};
      
      // Check if propertyId is a valid MongoDB ObjectId
      if (propertyId.match(/^[0-9a-fA-F]{24}$/)) {
        query = {
          $or: [
            { ruPropertyId: parseInt(propertyId) },
            { _id: propertyId }
          ]
        };
      } else {
        // If not a valid ObjectId, only search by ruPropertyId
        query = { ruPropertyId: parseInt(propertyId) };
      }
      
      const property = await Property.findOne(query);

      if (!property) {
        return res.status(404).json({
          success: false,
          message: 'Property not found'
        });
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check availability
      const unavailableDates = await AvailabilityCalendar.checkAvailability(
        property.ruPropertyId,
        new Date(checkIn),
        new Date(checkOut)
      );

      if (unavailableDates.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Selected dates are not available',
          unavailableDates: unavailableDates.map(d => d.date)
        });
      }

      // Get fresh pricing from API
      const xmlResponse = await ruClient.pullGetPropertyAvbPrice(
        property.ruPropertyId,
        checkIn,
        checkOut,
        numberOfGuests,
        'USD'
      );
      const parsedResponse = xmlParser.parse(xmlResponse);

      if (parsedResponse.error) {
        return res.status(400).json({
          success: false,
          error: parsedResponse.error,
          message: 'Error getting price quote from Rentals United'
        });
      }

      const priceData = parsedResponse?.Pull_GetPropertyAvbPrice_RS?.PropertyPrices;

      if (!priceData) {
        return res.status(400).json({
          success: false,
          message: 'No pricing available for selected dates'
        });
      }

      // Extract pricing information
      const propertyPrice = priceData.PropertyPrice;
      const basePrice = parseFloat(propertyPrice['#text'] || propertyPrice);
      const cleaningFee = parseFloat(propertyPrice['@_Cleaning'] || 0);
      const taxes = parseFloat(propertyPrice['@_Taxes'] || 0);
      const totalAmount = basePrice + cleaningFee + taxes;

      // Create booking in MongoDB
      const booking = new Booking({
        property: property._id,
        ruPropertyId: property.ruPropertyId,
        user: userId,
        guestInfo: {
          firstName: guestInfo.firstName,
          lastName: guestInfo.lastName,
          email: guestInfo.email,
          phone: guestInfo.phone,
          numberOfGuests,
          specialRequests
        },
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        pricing: {
          basePrice,
          cleaningFee,
          taxes,
          totalAmount,
          currency: 'USD',
          ruPrice: basePrice,
          clientPrice: totalAmount,
          alreadyPaid: 0
        },
        status: 'pending'
      });

      await booking.save();

      // Block dates in availability calendar
      await AvailabilityCalendar.blockDates(
        property.ruPropertyId,
        new Date(checkIn),
        new Date(checkOut),
        'booking_system'
      );

      res.status(201).json({
        success: true,
        data: {
          booking: {
            id: booking._id,
            bookingReference: booking.bookingReference,
            propertyId: property.ruPropertyId,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            totalAmount: booking.pricing.totalAmount,
            status: booking.status
          }
        },
        message: 'Booking created successfully. Please proceed with payment.'
      });

    } catch (error) {
      console.error('Error in createBooking:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Confirm booking after payment
  async confirmBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { paymentId, transactionId } = req.body;

      const booking = await Booking.findById(bookingId).populate('property');

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (booking.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Booking is not in pending status'
        });
      }

      // Update payment information
      booking.payment.paymentId = paymentId;
      booking.payment.transactionId = transactionId;
      booking.payment.paymentStatus = 'completed';
      booking.payment.paidAt = new Date();
      booking.pricing.alreadyPaid = booking.pricing.totalAmount;
      booking.status = 'confirmed';

      await booking.save();

      // Create reservation in Rentals United
      try {
        const reservationData = {
          propertyId: booking.ruPropertyId,
          dateFrom: booking.checkIn.toISOString().split('T')[0],
          dateTo: booking.checkOut.toISOString().split('T')[0],
          numberOfGuests: booking.guestInfo.numberOfGuests,
          ruPrice: booking.pricing.ruPrice,
          clientPrice: booking.pricing.clientPrice,
          alreadyPaid: booking.pricing.alreadyPaid,
          customerName: booking.guestInfo.firstName,
          customerSurname: booking.guestInfo.lastName,
          customerEmail: booking.guestInfo.email,
          customerPhone: booking.guestInfo.phone,
          comments: booking.guestInfo.specialRequests
        };

        const xmlResponse = await ruClient.pushPutConfirmedReservation(reservationData);
        const parsedResponse = xmlParser.parse(xmlResponse);

        if (parsedResponse.error) {
          // Mark for manual sync
          booking.syncStatus.needsSync = true;
          booking.syncStatus.lastSyncError = parsedResponse.error;
          await booking.save();

          console.error('Failed to create reservation in RU:', parsedResponse.error);
        } else {
          const reservationId = parsedResponse?.Push_PutConfirmedReservationMulti_RS?.ReservationID;
          if (reservationId) {
            booking.ruReservationId = reservationId;
            booking.status = 'ru_confirmed';
            booking.syncStatus.lastSyncedAt = new Date();
            await booking.save();
          }
        }
      } catch (ruError) {
        console.error('Error creating RU reservation:', ruError);
        booking.syncStatus.needsSync = true;
        booking.syncStatus.lastSyncError = ruError.message;
        await booking.save();
      }

      res.json({
        success: true,
        data: {
          booking: {
            id: booking._id,
            bookingReference: booking.bookingReference,
            ruReservationId: booking.ruReservationId,
            status: booking.status
          }
        },
        message: 'Booking confirmed successfully'
      });

    } catch (error) {
      console.error('Error in confirmBooking:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Cancel a booking
  async cancelBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { reason, cancelledBy = 'guest' } = req.body;

      const booking = await Booking.findById(bookingId);

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (['cancelled', 'refunded'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: 'Booking is already cancelled'
        });
      }

      // Cancel in Rentals United if it exists there
      if (booking.ruReservationId) {
        try {
          const xmlResponse = await ruClient.pushCancelReservation(
            booking.ruReservationId,
            cancelledBy === 'guest' ? 2 : 1
          );
          const parsedResponse = xmlParser.parse(xmlResponse);

          if (parsedResponse.error) {
            console.error('Failed to cancel in RU:', parsedResponse.error);
          }
        } catch (ruError) {
          console.error('Error cancelling RU reservation:', ruError);
        }
      }

      // Update booking status
      booking.status = 'cancelled';
      booking.cancellation = {
        cancelledAt: new Date(),
        cancelledBy,
        reason
      };

      await booking.save();

      // Unblock dates in availability calendar
      await AvailabilityCalendar.unblockDates(
        booking.ruPropertyId,
        booking.checkIn,
        booking.checkOut
      );

      res.json({
        success: true,
        data: {
          bookingId: booking._id,
          status: booking.status
        },
        message: 'Booking cancelled successfully'
      });

    } catch (error) {
      console.error('Error in cancelBooking:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get booking details
  async getBookingDetails(req, res) {
    try {
      const { bookingId } = req.params;

      const booking = await Booking.findById(bookingId)
        .populate('property', 'name images location checkInOut')
        .populate('user', 'firstName lastName email phone')
        .lean();

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      res.json({
        success: true,
        data: { booking }
      });

    } catch (error) {
      console.error('Error in getBookingDetails:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = new BookingController();