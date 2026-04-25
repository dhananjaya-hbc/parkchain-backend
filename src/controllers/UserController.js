// src/controllers/UserController.js
const User = require('../models/User');

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('--- Incoming Profile Update ---');
    console.log('Headers:', req.headers['content-type']);
    console.log('Body:', req.body);
    
    // Allow various keys from frontend
    const name = req.body.name !== undefined ? req.body.name : req.body.fullName;
    const licensePlate = req.body.licensePlate !== undefined ? req.body.licensePlate : req.body.license_no;
    const vehicleType = req.body.vehicleType !== undefined ? req.body.vehicleType : req.body.vehicle_type;

    console.log(`Parsed mapped data -> userId: ${userId}, name: ${name}, licensePlate: ${licensePlate}, vehicleType: ${vehicleType}`);

    // Only update allowed fields
    const updatedUser = await User.updateProfile(userId, { 
      name, 
      licensePlate,
      vehicleType
    });

    console.log('Updated user DB response:', updatedUser ? 'Success' : 'Not found');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

module.exports = {
  updateProfile
};