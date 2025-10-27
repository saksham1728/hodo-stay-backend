const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// POST /api/bookings - Create new booking
router.post('/', bookingController.createBooking);

// GET /api/bookings/:bookingId - Get booking by ID
router.get('/:bookingId', bookingController.getBookingById);

// GET /api/bookings/reference/:reference - Get booking by reference
router.get('/reference/:reference', bookingController.getBookingByReference);

// GET /api/bookings/user/:userId - Get user bookings
router.get('/user/:userId', bookingController.getUserBookings);

// PUT /api/bookings/:bookingId/status - Update booking status
router.put('/:bookingId/status', bookingController.updateBookingStatus);

// PUT /api/bookings/:bookingId/cancel - Cancel booking
router.put('/:bookingId/cancel', bookingController.cancelBooking);

// PUT /api/bookings/:bookingId/confirm - Confirm booking and push to RU
router.put('/:bookingId/confirm', bookingController.confirmBooking);

// GET /api/bookings/ru/reservations - Get reservations from Rentals United
router.get('/ru/reservations', bookingController.getRUReservations);

module.exports = router;