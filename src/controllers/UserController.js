// src/controllers/UserController.js
const User = require('../models/User');

const buildProfileResponse = (user) => {
  const data = {
    userId: user.id,
    fullName: user.name || null,
    phoneNumber: user.phone || null,
    licenseNo: user.license_no || null
  };

  if (user.vehicle_type) {
    data.vehicleType = user.vehicle_type;
  }

  return { data };
};

const getCanonicalLicenseNo = (body = {}) => (
  body.licenseNo || body.licenseNumber || body.licensePlate || null
);

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('--- Incoming Profile Update ---');
    console.log('Headers:', req.headers['content-type']);
    console.log('Body:', req.body);
    
    // Allow various keys from frontend
    const name = req.body.name !== undefined ? req.body.name : req.body.fullName;
    const phone = req.body.phone !== undefined ? req.body.phone : req.body.phoneNumber;
    const licenseNo = getCanonicalLicenseNo(req.body);
    const vehicleType = req.body.vehicle_type || req.body.vehicleType;

    console.log(`Parsed mapped data -> userId: ${userId}, name: ${name}, phone: ${phone}, licenseNo: ${licenseNo}, vehicleType: ${vehicleType}`);

    // Only update allowed fields
    const updatedUser = await User.updateProfile(userId, { 
      name, 
      phone,
      licenseNo,
      vehicleType
    });

    console.log('Updated user DB response:', updatedUser ? 'Success' : 'Not found');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(buildProfileResponse(updatedUser));
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(buildProfileResponse(user));
  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

module.exports = {
  updateProfile,
  getProfile,
  buildProfileResponse
};