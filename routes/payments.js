const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// POST /api/payments/create-order - Create Razorpay order
router.post('/create-order', paymentController.createOrder);

// POST /api/payments/verify - Verify payment and create booking
router.post('/verify', paymentController.verifyPayment);

// POST /api/payments/webhook - Handle Razorpay webhooks
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
