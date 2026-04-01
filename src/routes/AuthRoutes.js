// src/routes/AuthRoutes.js
const router = require('express').Router();
const AuthController = require('../controllers/AuthController');
const authMiddleware = require('../middleware/AuthMiddleware');
require('dotenv').config();

// Xaman register/login for drivers and sellers
router.post('/xaman', AuthController.xamanLogin);

// Admin login with email + password
router.post('/admin/login', AuthController.adminLogin);

// Get current logged-in user
router.get('/me', authMiddleware, AuthController.getMe);

// ============================================
// DEV ONLY: Test routes
// ============================================
if (process.env.NODE_ENV === 'development') {
  const jwt = require('jsonwebtoken');
  const { query } = require('../config/db');

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