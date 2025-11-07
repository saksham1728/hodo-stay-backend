const { Booking, Unit } = require('../models');
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

class BookingController {
  // Get booking by reference
  async getBookingByReference(req, res) {
    try {
      const { bookingReference } = req.params;

      const booking = await Booking.findOne({ bookingReference })
        .populate('unitId')
        .populate('buildingId');

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
      console.error('Error fetching booking:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch booking',
        error: error.message
      });
    }
  }

  // Get bookings by email (for guest checkout)
  async getBookingsByEmail(req, res) {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const bookings = await Booking.find({ 'guestInfo.email': email })
        .populate('unitId')
        .populate('buildingId')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: { bookings }
      });

    } catch (error) {
      console.error('Error fetching bookings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bookings',
        error: error.message
      });
    }
  }

  // Cancel booking
  async cancelBooking(req, res) {
    try {
      const { bookingReference } = req.params;
      const { reason, cancelledBy = 'guest' } = req.body;

      const booking = await Booking.findOne({ bookingReference });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (booking.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Booking is already cancelled'
        });
      }

      // Cancel in Rentals United if reservation exists
      if (booking.ruReservationId) {
        try {
          const cancelTypeId = cancelledBy === 'guest' ? 2 : 1;
          const ruResponse = await ruClient.pushCancelReservation(
            booking.ruReservationId,
            cancelTypeId
          );
          
          const parsedResponse = xmlParser.parse(ruResponse);
          console.log('RU cancellation response:', parsedResponse);
        } catch (ruError) {
          console.error('Error cancelling in RU:', ruError);
          // Continue with local cancellation even if RU fails
        }
      }

      // Update booking status
      booking.status = 'cancelled';
      booking.cancellation = {
        cancelledAt: new Date(),
        cancelledBy: cancelledBy,
        reason: reason || '',
        refundAmount: 0, // Calculate based on cancellation policy
        refundStatus: 'pending'
      };

      await booking.save();

      res.json({
        success: true,
        message: 'Booking cancelled successfully',
        data: { booking }
      });

    } catch (error) {
      console.error('Error cancelling booking:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel booking',
        error: error.message
      });
    }
  }

  // Get all bookings (admin)
  async getAllBookings(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;

      const query = {};
      if (status) {
        query.status = status;
      }

      const skip = (page - 1) * limit;

      const bookings = await Booking.find(query)
        .populate('unitId')
        .populate('buildingId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

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
      console.error('Error fetching all bookings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bookings',
        error: error.message
      });
    }
  }
}

const bookingController = new BookingController();
module.exports = bookingController;
