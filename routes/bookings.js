const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// GET /api/bookings/reference/:bookingReference - Get booking by reference
router.get('/reference/:bookingReference', bookingController.getBookingByReference);

// GET /api/bookings/email - Get bookings by email
router.get('/email', bookingController.getBookingsByEmail);

// GET /api/bookings - Get all bookings (admin)
router.get('/', bookingController.getAllBookings);

// POST /api/bookings/:bookingReference/cancel - Cancel booking
router.post('/:bookingReference/cancel', bookingController.cancelBooking);

module.exports = router;
