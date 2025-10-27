const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// POST /api/users - Create or get user
router.post('/', userController.createOrGetUser);

// GET /api/users/:userId - Get user by ID
router.get('/:userId', userController.getUserById);

// PUT /api/users/:userId - Update user
router.put('/:userId', userController.updateUser);

module.exports = router;