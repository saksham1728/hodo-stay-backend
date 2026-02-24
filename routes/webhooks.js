const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

/**
 * RU Webhook endpoint
 * POST /api/webhooks/rentals-united
 * 
 * Receives XML notifications from Rentals United for:
 * - Confirmed reservations
 * - Cancellations
 * - Unconfirmed reservations (requests)
 * - Leads
 */
router.post('/rentals-united', 
  express.text({ type: 'application/xml' }), // Parse XML as text
  webhookController.handleRUWebhook.bind(webhookController)
);

module.exports = router;
