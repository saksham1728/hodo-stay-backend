const express = require('express');
const router = express.Router();
const buildingController = require('../controllers/buildingController');

// GET /api/buildings - Get all buildings (property groups)
router.get('/', buildingController.getBuildings);

// GET /api/buildings/:buildingId - Get building details with all units
router.get('/:buildingId', buildingController.getBuildingDetails);

module.exports = router;