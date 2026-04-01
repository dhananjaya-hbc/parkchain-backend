// src/routes/AuthRoutes.js

const router = require('express').Router();
const AuthController = require('../controllers/AuthController');
const authMiddleware = require('../middleware/AuthMiddleware');
require('dotenv').config();

// Web3Auth register/login for drivers and sellers
router.post('/web3auth', AuthController.web3AuthLogin);

// Xaman register/login for drivers and sellers
router.post('/xaman', AuthController.xamanLogin);

// Admin login with email + password
router.post('/admin/login', AuthController.adminLogin);

// Get current logged-in user (works with both Web3Auth token and JWT)
router.get('/me', authMiddleware, AuthController.getMe);

// ============================================
// DEV ONLY: Test route to get a token for any user
// ============================================
// This lets you test in Postman without needing Web3Auth frontend
// REMOVE THIS IN PRODUCTION!
if (process.env.NODE_ENV === 'development') {

  const jwt = require('jsonwebtoken');
  const { query } = require('../config/db');

  // Existing dev token route
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

  // NEW: Reset wallet for testing
  router.post('/dev/reset-wallet', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
      }

      const result = await query(
        `UPDATE users 
         SET wallet_address = NULL, wallet_seed = NULL, updated_at = NOW()
         WHERE email = $1
         RETURNING email, role, wallet_address`,
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }

      console.log(`🧪 DEV: Wallet reset for ${result.rows[0].email}`);
      res.json({
        message: 'Wallet cleared. You can now generate a real one.',
        user: result.rows[0]
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log('⚠️  DEV MODE: Test token route enabled at POST /api/auth/dev/token');
  console.log('⚠️  DEV MODE: Wallet reset route enabled at POST /api/auth/dev/reset-wallet');
}

module.exports = router;