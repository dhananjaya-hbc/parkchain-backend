const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const AuthController = require('../controllers/AuthController');
const authMiddleware = require('../middleware/AuthMiddleware');
const { query } = require('../config/db');

const router = express.Router();

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP address to 5 attempts per window
  message: { error: 'Too many password change attempts from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Xaman login for drivers and sellers
router.post('/xaman', AuthController.xamanLogin);

// Admin login with email + password
router.post('/admin/login', AuthController.adminLogin);

// Change password for admin users
router.put(
  '/admin/change-password', 
  authMiddleware, 
  passwordChangeLimiter, 
  AuthController.changePassword
);

// Get current logged-in user
router.get('/me', authMiddleware, AuthController.getMe);


// ============================================
// DEV ONLY: Test routes
// ============================================
if (process.env.NODE_ENV === 'development') {
  router.post('/dev/token', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
      }
      const result = await query(
        'SELECT id, email, name, role, wallet_address FROM users WHERE email = $1',
        [email]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }
      const user = result.rows[0];
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );
      console.log(`🧪 DEV TOKEN generated for ${user.role}: ${user.email}`);
      res.json({ message: '⚠️ DEV ONLY', token, user });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log('⚠️  DEV MODE: Test token route enabled at POST /api/auth/dev/token');
}

module.exports = router;