const { Booking, User, Unit } = require('../models');
const ruClient = require('../utils/ruClient');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser();

class BookingController {
  // Create a new booking
  async createBooking(req, res) {
    try {
      const {
        userId,
        unitId,
        checkInDate,
        checkOutDate,
        guests,
        pricing,
        guestInfo,
        specialRequests
      } = req.body;
      
      // Validate required fields
      if (!userId || !unitId || !checkInDate || !checkOutDate || !guests || !pricing) {
        return res.status(400).json({
          success: false,
          message: 'Missing required booking information'
        });
      }
      
      // Validate dates
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (checkIn < today) {
        return res.status(400).json({
          success: false,
          message: 'Check-in date cannot be in the past'
        });
      }
      
      if (checkOut <= checkIn) {
        return res.status(400).json({
          success: false,
          message: 'Check-out date must be after check-in date'
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
      
      // Check if unit exists
      const unit = await Unit.findById(unitId);
      if (!unit) {
        return res.status(404).json({
          success: false,
          message: 'Unit not found'
        });
      }
      
      // Check for conflicting bookings
      const conflictingBooking = await Booking.findOne({
        unitId: unitId,
        status: { $in: ['pending', 'confirmed'] },
        $or: [
          {
            checkInDate: { $lte: checkOut },
            checkOutDate: { $gte: checkIn }
          }
        ]
      });
      
      if (conflictingBooking) {
        return res.status(400).json({
          success: false,
          message: 'Unit is not available for the selected dates'
        });
      }
      
      // Calculate nights
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      
      // Create booking
      const booking = new Booking({
        userId,
        buildingId: unit.buildingId,
        unitId,
        ruPropertyId: unit.ruPropertyId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guests: {
          adults: guests.adults,
          children: guests.children || 0,
          total: guests.adults + (guests.children || 0)
        },
        pricing: {
          ...pricing,
          nights
        },
        guestInfo: {
          primaryGuest: guestInfo,
          specialRequests: specialRequests || ''
        }
      });
      
      await booking.save();
      
      // Update user booking count
      await User.findByIdAndUpdate(userId, {
        $inc: { totalBookings: 1 }
      });
      
      // Populate booking with user and unit details
      const populatedBooking = await Booking.findById(booking._id)
        .populate('userId', 'firstName lastName email phone')
        .populate('unitId', 'name images');
      
      res.status(201).json({
        success: true,
        data: {
          booking: populatedBooking
        }
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

  // Get booking by ID
  async getBookingById(req, res) {
    try {
      const { bookingId } = req.params;
      
      const booking = await Booking.findById(bookingId)
        .populate('userId', 'firstName lastName email phone')
        .populate('unitId', 'name images buildingId');
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          booking
        }
      });
      
    } catch (error) {
      console.error('Error in getBookingById:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get booking by reference
  async getBookingByReference(req, res) {
    try {
      const { reference } = req.params;
      
      const booking = await Booking.findOne({ bookingReference: reference.toUpperCase() })
        .populate('userId', 'firstName lastName email phone')
        .populate('unitId', 'name images buildingId');
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          booking
        }
      });
      
    } catch (error) {
      console.error('Error in getBookingByReference:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get user bookings
  async getUserBookings(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 10, status } = req.query;
      
      // Build query
      const query = { userId };
      if (status) {
        query.status = status;
      }
      
      // Pagination
      const skip = (page - 1) * limit;
      
      const bookings = await Booking.find(query)
        .populate('unitId', 'name images buildingId')
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
      console.error('Error in getUserBookings:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update booking status
  async updateBookingStatus(req, res) {
    try {
      const { bookingId } = req.params;
      const { status, notes } = req.body;
      
      const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'no-show'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking status'
        });
      }
      
      const updateData = { status };
      
      // Add notes if provided
      if (notes) {
        updateData.$push = {
          notes: {
            message: notes,
            addedBy: 'system',
            addedAt: new Date()
          }
        };
      }
      
      const booking = await Booking.findByIdAndUpdate(
        bookingId,
        updateData,
        { new: true }
      ).populate('userId', 'firstName lastName email phone')
       .populate('unitId', 'name images buildingId');
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          booking
        }
      });
      
    } catch (error) {
      console.error('Error in updateBookingStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Cancel booking
  async cancelBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { reason, refundAmount } = req.body;
      
      const booking = await Booking.findById(bookingId)
        .populate('userId', 'firstName lastName email phone')
        .populate('unitId', 'name images buildingId');
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      // Cancel in Rentals United if booking was pushed there
      if (booking.ruBookingId) {
        try {
          console.log(`Cancelling booking in Rentals United: ${booking.ruBookingId}`);
          const xmlResponse = await ruClient.pushCancelReservation(booking.ruBookingId, 2);
          const parsedResponse = xmlParser.parse(xmlResponse);
          
          if (parsedResponse.error) {
            console.error('RU cancellation failed:', parsedResponse.error);
            // Continue with local cancellation even if RU fails
          } else {
            console.log('✅ Booking cancelled in Rentals United');
          }
        } catch (ruError) {
          console.error('Error cancelling in RU:', ruError);
          // Continue with local cancellation
        }
      }
      
      // Update local booking
      const updatedBooking = await Booking.findByIdAndUpdate(
        bookingId,
        {
          status: 'cancelled',
          cancellation: {
            cancelledAt: new Date(),
            cancelledBy: 'user',
            reason: reason || 'User cancellation',
            refundAmount: refundAmount || 0
          }
        },
        { new: true }
      ).populate('userId', 'firstName lastName email phone')
       .populate('unitId', 'name images buildingId');
      
      res.json({
        success: true,
        data: {
          booking: updatedBooking
        }
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

  // Confirm booking and push to Rentals United
  async confirmBooking(req, res) {
    try {
      const { bookingId } = req.params;
      
      const booking = await Booking.findById(bookingId)
        .populate('userId', 'firstName lastName email phone')
        .populate('unitId', 'name ruPropertyId');
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      if (booking.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending bookings can be confirmed'
        });
      }
      
      // Push booking to Rentals United
      try {
        console.log(`Pushing booking to Rentals United: ${booking.bookingReference}`);
        
        const reservationData = {
          propertyId: booking.unitId.ruPropertyId,
          dateFrom: booking.checkInDate.toISOString().split('T')[0],
          dateTo: booking.checkOutDate.toISOString().split('T')[0],
          numberOfGuests: booking.guests.total,
          ruPrice: booking.pricing.totalAmount,
          clientPrice: booking.pricing.totalAmount,
          alreadyPaid: booking.payment.status === 'paid' ? booking.pricing.totalAmount : 0,
          customerName: booking.userId.firstName,
          customerSurname: booking.userId.lastName,
          customerEmail: booking.userId.email,
          customerPhone: booking.userId.phone || '',
          comments: `Hodo Stay Booking: ${booking.bookingReference}. ${booking.guestInfo.specialRequests || ''}`
        };
        
        const xmlResponse = await ruClient.pushPutConfirmedReservation(reservationData);
        const parsedResponse = xmlParser.parse(xmlResponse);
        
        if (parsedResponse.error) {
          console.error('RU booking creation failed:', parsedResponse.error);
          return res.status(400).json({
            success: false,
            message: 'Failed to confirm booking with Rentals United',
            error: parsedResponse.error
          });
        }
        
        // Extract RU booking ID from response
        const ruBookingId = parsedResponse?.Push_PutConfirmedReservationMulti_RS?.ReservationID;
        
        // Update local booking with RU booking ID and confirm status
        const updatedBooking = await Booking.findByIdAndUpdate(
          bookingId,
          {
            status: 'confirmed',
            ruBookingId: ruBookingId,
            $push: {
              notes: {
                message: `Booking confirmed and pushed to Rentals United. RU Booking ID: ${ruBookingId}`,
                addedBy: 'system',
                addedAt: new Date()
              }
            }
          },
          { new: true }
        ).populate('userId', 'firstName lastName email phone')
         .populate('unitId', 'name images buildingId');
        
        console.log(`✅ Booking confirmed in Rentals United with ID: ${ruBookingId}`);
        
        res.json({
          success: true,
          data: {
            booking: updatedBooking
          }
        });
        
      } catch (ruError) {
        console.error('Error pushing to RU:', ruError);
        res.status(500).json({
          success: false,
          message: 'Failed to confirm booking with Rentals United',
          error: ruError.message
        });
      }
      
    } catch (error) {
      console.error('Error in confirmBooking:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get reservations from Rentals United
  async getRUReservations(req, res) {
    try {
      const { dateFrom, dateTo, locationId = 0 } = req.query;
      
      if (!dateFrom || !dateTo) {
        return res.status(400).json({
          success: false,
          message: 'dateFrom and dateTo are required'
        });
      }
      
      console.log(`Fetching RU reservations from ${dateFrom} to ${dateTo}`);
      
      const xmlResponse = await ruClient.pullListReservations(dateFrom, dateTo, locationId);
      const parsedResponse = xmlParser.parse(xmlResponse);
      
      if (parsedResponse.error) {
        return res.status(400).json({
          success: false,
          error: parsedResponse.error,
          message: 'Error fetching reservations from Rentals United'
        });
      }
      
      const reservations = parsedResponse?.Pull_ListReservations_RS?.Reservations?.Reservation || [];
      const reservationsArray = Array.isArray(reservations) ? reservations : [reservations];
      
      res.json({
        success: true,
        data: {
          reservations: reservationsArray,
          dateFrom,
          dateTo,
          locationId,
          total: reservationsArray.length
        }
      });
      
    } catch (error) {
      console.error('Error in getRUReservations:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

const bookingController = new BookingController();
module.exports = bookingController;