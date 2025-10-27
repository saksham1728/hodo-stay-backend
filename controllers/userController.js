const { User } = require('../models');

class UserController {
  // Create or get user
  async createOrGetUser(req, res) {
    try {
      const { firstName, lastName, email, phone, address } = req.body;
      
      // Validate required fields
      if (!firstName || !lastName || !email || !phone) {
        return res.status(400).json({
          success: false,
          message: 'First name, last name, email, and phone are required'
        });
      }
      
      // Check if user already exists
      let user = await User.findOne({ email: email.toLowerCase() });
      
      if (user) {
        // Update existing user info
        user = await User.findOneAndUpdate(
          { email: email.toLowerCase() },
          {
            firstName,
            lastName,
            phone,
            address: address || user.address
          },
          { new: true }
        );
      } else {
        // Create new user
        user = new User({
          firstName,
          lastName,
          email: email.toLowerCase(),
          phone,
          address
        });
        
        await user.save();
      }
      
      res.json({
        success: true,
        data: {
          user
        }
      });
      
    } catch (error) {
      console.error('Error in createOrGetUser:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get user by ID
  async getUserById(req, res) {
    try {
      const { userId } = req.params;
      
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          user
        }
      });
      
    } catch (error) {
      console.error('Error in getUserById:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update user
  async updateUser(req, res) {
    try {
      const { userId } = req.params;
      const updateData = req.body;
      
      const user = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          user
        }
      });
      
    } catch (error) {
      console.error('Error in updateUser:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

const userController = new UserController();
module.exports = userController;