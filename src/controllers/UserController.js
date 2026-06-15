// src/controllers/UserController.js
const User = require('../models/User');

const buildProfileResponse = (user) => {
  const data = {
    userId: user.id,
    fullName: user.name || null,
    email: user.email || null,
    phoneNumber: user.phone || null,
    licenseNo: user.license_no || null,
    profileImageUrl: user.profile_image || null,
    profileCompleted: User.isProfileCompleted(user)
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
    const email = req.body.email;
    const licenseNo = getCanonicalLicenseNo(req.body);
    const vehicleType = req.body.vehicle_type || req.body.vehicleType;

    console.log(`Parsed mapped data -> userId: ${userId}, name: ${name}, email: ${email}, phone: ${phone}, licenseNo: ${licenseNo}, vehicleType: ${vehicleType}`);

    // Only update allowed fields
    const updatedUser = await User.updateProfile(userId, { 
      name, 
      email,
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

const uploadProfileImage = async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const profileImage = req.file.path;
    
    const updatedUser = await User.updateProfile(userId, { profileImage });
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      success: true,
      imageUrl: updatedUser.profile_image
    });
  } catch (error) {
    console.error('Upload profile image error:', error.message);
    res.status(500).json({ error: 'Failed to upload profile image' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch the user from the database
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return the raw user object so the admin gets all details (wallet_address, etc)
    res.status(200).json({ user: user });

  } catch (error) {
    console.error('Get user by id error:', error.message);
    res.status(500).json({ error: 'Failed to get user details' });
  }
};

const getUsers = async (req, res) => {
  try {
    const { role } = req.query;
    
    if (role === 'seller') {
      const sellers = await User.getSellersWithStats();
      return res.status(200).json(sellers);
    }
    
    const users = await User.findAll(role);
    res.status(200).json(users);
  } catch (error) {
    console.error('Get users error:', error.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status provided' });
    }

    const updatedUser = await User.updateStatus(id, status);

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'Success', user: updatedUser });
  } catch (error) {
    console.error('Update user status error:', error.message);
    res.status(500).json({ error: 'Failed to update user status' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedUser = await User.remove(id);

    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'User successfully removed' });
  } catch (error) {
    console.error('Delete user error:', error.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

module.exports = {
  updateProfile,
  getProfile,
  uploadProfileImage,
  getUserById,
  getUsers,
  updateUserStatus,
  deleteUser,
  buildProfileResponse
};