const express = require('express');
const router = express.Router();
const buildingController = require('../controllers/buildingController');

// GET /api/buildings - Get all buildings
router.get('/', buildingController.getBuildings);

// POST /api/buildings - Create a new building
router.post('/', buildingController.createBuilding);

// GET /api/buildings/:buildingId - Get building details with all units
router.get('/:buildingId', buildingController.getBuildingDetails);

// POST /api/buildings/:buildingId/sync-units - Sync units from RU API
router.post('/:buildingId/sync-units', buildingController.syncUnitsForBuilding);

module.exports = router;