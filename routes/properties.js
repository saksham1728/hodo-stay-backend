const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');
const { optionalAuth, adminOnly } = require('../middleware/auth');
const { validatePropertyQuote, validatePagination } = require('../middleware/validation');

// GET /api/properties - Get all properties in a location
router.get('/', 
  validatePagination,
  optionalAuth,
  propertyController.getProperties
);

// GET /api/properties/:propertyId - Get specific property details
router.get('/:propertyId', 
  optionalAuth,
  propertyController.getPropertyDetails
);

// GET /api/properties/:propertyId/quote - Get price quote for specific dates
router.get('/:propertyId/quote', 
  validatePropertyQuote,
  propertyController.getPropertyQuote
);

// POST /api/properties/sync - Sync properties from Rentals United (Admin only)
router.post('/sync',
  adminOnly,
  propertyController.syncPropertiesFromAPI
);

module.exports = router;