const express = require('express');
const authMiddleware = require('../middleware/AuthMiddleware');
const roleMiddleware = require('../middleware/RoleMiddleware');
const UserController = require('../controllers/UserController');
const { profileUpload } = require('../config/cloudinary');

const router = express.Router();

// GET /api/users - Gets users (accepts ?role=seller query param)
router.get('/', authMiddleware, roleMiddleware('admin'), UserController.getUsers);

// GET /api/users/profile - Gets current user profile in canonical shape
router.get('/profile', authMiddleware, UserController.getProfile);

// GET /api/users/:id - Gets a specific user by ID
router.get('/:id', authMiddleware, UserController.getUserById);

// PATCH /api/users/:id/status - Update user status
router.patch('/:id/status', authMiddleware, roleMiddleware('admin'), UserController.updateUserStatus);

// DELETE /api/users/:id - Delete a user
router.delete('/:id', authMiddleware, roleMiddleware('admin'), UserController.deleteUser);

// PUT /api/users/profile - Updates user profile (name, licensePlate, etc)
router.put('/profile', authMiddleware, UserController.updateProfile);

// POST /api/users/profile/image - Uploads user profile image
router.post('/profile/image', authMiddleware, profileUpload.single('image'), UserController.uploadProfileImage);

module.exports = router;
