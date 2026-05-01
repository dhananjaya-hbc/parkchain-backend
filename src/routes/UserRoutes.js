const express = require('express');
const authMiddleware = require('../middleware/AuthMiddleware');
const UserController = require('../controllers/UserController');
const { profileUpload } = require('../config/cloudinary');

const router = express.Router();

// GET /api/users/profile - Gets current user profile in canonical shape
router.get('/profile', authMiddleware, UserController.getProfile);

// GET /api/users/:id - Gets a specific user by ID
router.get('/:id', authMiddleware, UserController.getUserById);

// PUT /api/users/profile - Updates user profile (name, licensePlate, etc)
router.put('/profile', authMiddleware, UserController.updateProfile);

// POST /api/users/profile/image - Uploads user profile image
router.post('/profile/image', authMiddleware, profileUpload.single('image'), UserController.uploadProfileImage);

module.exports = router;
