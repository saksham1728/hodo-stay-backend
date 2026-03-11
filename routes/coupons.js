const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const rateLimit = require('express-rate-limit');

// Rate limiter for validation endpoint (prevent brute force)
const validateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many coupon validation attempts, please try again later'
});

// ============ PUBLIC ROUTES ============

// Validate coupon
router.post('/validate', validateLimiter, couponController.validateCoupon);

// Get available coupons for user
router.get('/available', couponController.getAvailableCoupons);

// ============ ADMIN ROUTES ============
// TODO: Add authentication middleware

// Create coupon
router.post('/', couponController.createCoupon);

// Get all coupons
router.get('/', couponController.getAllCoupons);

// Get coupon analytics
router.get('/analytics', couponController.getCouponAnalytics);

// Get single coupon
router.get('/:id', couponController.getCoupon);

// Update coupon
router.put('/:id', couponController.updateCoupon);

// Toggle coupon active status
router.patch('/:id/toggle', couponController.toggleCoupon);

// Delete coupon
router.delete('/:id', couponController.deleteCoupon);

module.exports = router;
