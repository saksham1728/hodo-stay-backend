const express = require('express');
const router = express.Router();
const buildingController = require('../controllers/buildingController');

// GET /api/buildings - Get all buildings
router.get('/', buildingController.getAllBuildings);

// POST /api/buildings/best-available - Get cheapest available unit (MUST be before /:buildingId)
router.post('/best-available', buildingController.getBestAvailableUnit);

// POST /api/buildings - Create new building
router.post('/', buildingController.createBuilding);

// PUT /api/buildings/:buildingId - Update building
router.put('/:buildingId', buildingController.updateBuilding);

// DELETE /api/buildings/:buildingId - Soft delete building
router.delete('/:buildingId', buildingController.deleteBuilding);

// GET /api/buildings/:buildingId/unit-types - Get building with grouped unit types
router.get('/:buildingId/unit-types', buildingController.getBuildingWithUnitTypes);

// GET /api/buildings/:buildingId - Get building by ID
router.get('/:buildingId', buildingController.getBuildingById);

module.exports = router;
