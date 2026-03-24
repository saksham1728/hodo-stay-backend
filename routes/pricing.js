const express = require('express');
const router = express.Router();
const pricingController = require('../controllers/pricingController');

// CACHE-BASED ENDPOINTS (Fast - uses MongoDB cache)

// Search available units with cached pricing
// GET /api/pricing/search?roomType=2bhk&checkIn=2024-03-01&checkOut=2024-03-04&buildingId=xxx
router.get('/search', pricingController.searchAvailableUnits);

// Get pricing for specific unit
// GET /api/pricing/unit/:unitId?checkIn=2024-03-01&checkOut=2024-03-04
router.get('/unit/:unitId', pricingController.getUnitPricing);

// Check availability for specific unit and dates (final check before payment)
// POST /api/pricing/check-availability
router.post('/check-availability', pricingController.checkAvailability);

// Calculate GST for a booking
// POST /api/pricing/calculate-gst
router.post('/calculate-gst', pricingController.calculateGST);

// Trigger manual sync (admin)
// POST /api/pricing/sync
router.post('/sync', pricingController.triggerSync);

// Get sync status
// GET /api/pricing/sync-status
router.get('/sync-status', pricingController.getSyncStatus);

module.exports = router;