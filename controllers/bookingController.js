const { Booking, Unit } = require('../models');
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');
const emailService = require('../services/emailService');

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

  // Get bookings by access token (secure method)
  async getBookingsByToken(req, res) {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Access token is required'
        });
      }

      // Find booking by token
      const booking = await Booking.findOne({ accessToken: token })
        .populate('unitId')
        .populate('buildingId');

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Invalid or expired access token'
        });
      }

      // Check if token is expired
      if (new Date() > booking.tokenExpiresAt) {
        return res.status(401).json({
          success: false,
          message: 'Access token has expired'
        });
      }

      // Get all bookings for this email
      const allBookings = await Booking.find({ 'guestInfo.email': booking.guestInfo.email })
        .populate('unitId')
        .populate('buildingId')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        data: { 
          bookings: allBookings,
          email: booking.guestInfo.email
        }
      });

    } catch (error) {
      console.error('Error fetching bookings by token:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bookings',
        error: error.message
      });
    }
  }

  // Request access link via email
  async requestAccessLink(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Find all bookings for this email
      const bookings = await Booking.find({ 'guestInfo.email': email })
        .populate('unitId')
        .populate('buildingId')
        .sort({ createdAt: -1 });

      if (bookings.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No bookings found for this email address'
        });
      }

      // Send access link email
      try {
        await emailService.sendAccessLink(email, bookings);
        console.log('✅ Access link email sent to:', email);
      } catch (emailError) {
        console.error('❌ Error sending access link email:', emailError);
        return res.status(500).json({
          success: false,
          message: 'Failed to send access link email'
        });
      }

      res.json({
        success: true,
        message: 'Access link sent to your email',
        data: {
          bookingsCount: bookings.length
        }
      });

    } catch (error) {
      console.error('Error requesting access link:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send access link',
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

      // Populate for email
      await booking.populate('unitId');
      await booking.populate('buildingId');

      // Send cancellation confirmation email
      try {
        await emailService.sendCancellationConfirmation(booking);
        console.log('✅ Cancellation email sent to:', booking.guestInfo.email);
      } catch (emailError) {
        console.error('❌ Error sending cancellation email:', emailError);
        // Don't fail the cancellation if email fails
      }

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

  // List reservations from Rentals United by date range
  async listReservationsFromRU(req, res) {
    try {
      let { dateFrom, dateTo, locationId } = req.query;

      if (!dateFrom || !dateTo) {
        return res.status(400).json({
          success: false,
          message: 'dateFrom and dateTo are required (format: YYYY-MM-DD or YYYY-MM-DD HH:mm:ss)'
        });
      }

      // Ensure dates include time format (HH:mm:ss) as required by Rentals United API
      if (!dateFrom.includes(':')) {
        dateFrom = `${dateFrom} 00:00:00`;
      }
      if (!dateTo.includes(':')) {
        dateTo = `${dateTo} 23:59:59`;
      }

      // Default locationId to 41982 (HSR Layout) if not provided
      const finalLocationId = locationId || 41982;

      console.log(`📥 Fetching reservations from RU: ${dateFrom} to ${dateTo} (LocationID: ${finalLocationId})`);

      const response = await ruClient.pullListReservations(dateFrom, dateTo, finalLocationId);
      const parsedResponse = xmlParser.parse(response);

      const reservationsList = parsedResponse.Pull_ListReservations_RS?.Reservations?.Reservation;

      if (!reservationsList) {
        return res.json({
          success: true,
          data: { reservations: [] },
          message: 'No reservations found for the specified date range'
        });
      }

      const reservations = Array.isArray(reservationsList) ? reservationsList : [reservationsList];

      const formattedReservations = reservations.map(res => ({
        ruReservationId: res.ReservationID,
        status: res.StatusID,
        createdDate: res.CreatedDate,
        propertyId: res.StayInfos?.StayInfo?.PropertyID,
        dateFrom: res.StayInfos?.StayInfo?.DateFrom,
        dateTo: res.StayInfos?.StayInfo?.DateTo,
        numberOfGuests: res.StayInfos?.StayInfo?.NumberOfGuests,
        clientPrice: res.StayInfos?.StayInfo?.Costs?.ClientPrice,
        customerName: `${res.CustomerInfo?.Name || ''} ${res.CustomerInfo?.SurName || ''}`.trim(),
        customerEmail: res.CustomerInfo?.Email
      }));

      res.json({
        success: true,
        data: { reservations: formattedReservations, count: formattedReservations.length },
        message: `Found ${formattedReservations.length} reservations`
      });

    } catch (error) {
      console.error('❌ Error listing reservations from RU:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to list reservations from Rentals United',
        error: error.message
      });
    }
  }

  // Fetch specific booking from Rentals United
  async fetchBookingFromRU(req, res) {
    try {
      const { ruReservationId } = req.params;

      if (!ruReservationId) {
        return res.status(400).json({
          success: false,
          message: 'RU Reservation ID is required'
        });
      }

      console.log(`📥 Fetching booking from RU: ${ruReservationId}`);

      const response = await ruClient.pullGetReservation(ruReservationId);
      const parsedResponse = xmlParser.parse(response);

      const reservation = parsedResponse.Pull_GetReservation_RS?.Reservation;

      if (!reservation) {
        return res.status(404).json({
          success: false,
          message: 'Reservation not found in Rentals United'
        });
      }

      res.json({
        success: true,
        data: { reservation }
      });

    } catch (error) {
      console.error('❌ Error fetching booking from RU:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch booking from Rentals United',
        error: error.message
      });
    }
  }
}

const bookingController = new BookingController();
module.exports = bookingController;
