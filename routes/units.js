const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');

// GET /api/units/:unitId - Get unit details
router.get('/:unitId', unitController.getUnitDetails);

// GET /api/units/:unitId/availability - Get unit availability and pricing
router.get('/:unitId/availability', unitController.getUnitAvailabilityPrice);

module.exports = router;