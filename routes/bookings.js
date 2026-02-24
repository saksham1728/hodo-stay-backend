const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// GET /api/bookings/reference/:bookingReference - Get booking by reference
router.get('/reference/:bookingReference', bookingController.getBookingByReference);

// GET /api/bookings/by-token - Get bookings by access token (secure)
router.get('/by-token', bookingController.getBookingsByToken);

// POST /api/bookings/request-access - Request access link via email
router.post('/request-access', bookingController.requestAccessLink);

// GET /api/bookings/ru-list - List reservations from Rentals United by date range
router.get('/ru-list', bookingController.listReservationsFromRU);

// GET /api/bookings/ru/:ruReservationId - Fetch booking details from Rentals United
router.get('/ru/:ruReservationId', bookingController.fetchBookingFromRU);

// GET /api/bookings - Get all bookings (admin)
router.get('/', bookingController.getAllBookings);

// POST /api/bookings/:bookingReference/cancel - Cancel booking
router.post('/:bookingReference/cancel', bookingController.cancelBooking);

module.exports = router;
