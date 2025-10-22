const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, adminOnly, ownerOrAdmin } = require('../middleware/auth');
const { 
  validateUserRegistration, 
  validateUserLogin, 
  validateObjectId,
  validatePagination 
} = require('../middleware/validation');

// POST /api/users/register - Register new user
router.post('/register',
  validateUserRegistration,
  userController.register
);

// POST /api/users/login - Login user
router.post('/login',
  validateUserLogin,
  userController.login
);

// GET /api/users/verify/:token - Verify email
router.get('/verify/:token',
  userController.verifyEmail
);

// POST /api/users/forgot-password - Forgot password
router.post('/forgot-password',
  userController.forgotPassword
);

// POST /api/users/reset-password/:token - Reset password
router.post('/reset-password/:token',
  userController.resetPassword
);

// GET /api/users/:userId - Get user profile
router.get('/:userId',
  authenticate,
  ownerOrAdmin(),
  validateObjectId('userId'),
  userController.getProfile
);

// PUT /api/users/:userId - Update user profile
router.put('/:userId',
  authenticate,
  ownerOrAdmin(),
  validateObjectId('userId'),
  userController.updateProfile
);

// PUT /api/users/:userId/change-password - Change password
router.put('/:userId/change-password',
  authenticate,
  ownerOrAdmin(),
  validateObjectId('userId'),
  userController.changePassword
);

// GET /api/users - Get all users (Admin only)
router.get('/',
  authenticate,
  adminOnly,
  validatePagination,
  userController.getAllUsers
);

module.exports = router;