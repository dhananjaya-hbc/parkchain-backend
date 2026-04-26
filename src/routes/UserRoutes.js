const express = require('express');
const authMiddleware = require('../middleware/AuthMiddleware');
const UserController = require('../controllers/UserController');

const router = express.Router();

// GET /api/users/profile - Gets current user profile in canonical shape
router.get('/profile', authMiddleware, UserController.getProfile);

// PUT /api/users/profile - Updates user profile (name, licensePlate, etc)
router.put('/profile', authMiddleware, UserController.updateProfile);

module.exports = router;
