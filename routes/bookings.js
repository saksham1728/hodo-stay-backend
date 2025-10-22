const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticate, adminOnly, ownerOrAdmin } = require('../middleware/auth');
const { validateBookingCreation, validateObjectId, validatePagination } = require('../middleware/validation');

// GET /api/bookings - Get all reservations (Admin only)
router.get('/',
  authenticate,
  adminOnly,
  validatePagination,
  bookingController.getAllReservations
);

// GET /api/bookings/user/:userId - Get user's bookings
router.get('/user/:userId',
  authenticate,
  ownerOrAdmin(),
  validateObjectId('userId'),
  validatePagination,
  bookingController.getUserBookings
);

// GET /api/bookings/:bookingId - Get booking details
router.get('/:bookingId',
  authenticate,
  validateObjectId('bookingId'),
  bookingController.getBookingDetails
);

// POST /api/bookings - Create a new booking
router.post('/',
  authenticate,
  validateBookingCreation,
  bookingController.createBooking
);

// PUT /api/bookings/:bookingId/confirm - Confirm booking after payment
router.put('/:bookingId/confirm',
  authenticate,
  validateObjectId('bookingId'),
  bookingController.confirmBooking
);

// DELETE /api/bookings/:bookingId - Cancel a booking
router.delete('/:bookingId',
  authenticate,
  validateObjectId('bookingId'),
  bookingController.cancelBooking
);

module.exports = router;