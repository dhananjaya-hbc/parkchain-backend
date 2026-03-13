// src/routes/XummRoutes.js
// ============================================
// XUMM (XAMAN) AUTH ROUTES
// ============================================
//
// POST /api/auth/xumm/login    → Create sign-in payload
// POST /api/auth/xumm/verify   → Verify signed payload → get JWT

const router = require('express').Router();
const jwt = require('jsonwebtoken');
const xummService = require('../services/XummService');
const User = require('../models/User');
require('dotenv').config();

const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ============================================
// POST /api/auth/xumm/login
// ============================================
// Flutter calls this to start the Xaman login flow
// Returns a deep link to open the Xaman app
router.post('/login', async (req, res) => {
  try {
    const payload = await xummService.createSignInPayload();

    res.json({
      message: 'Open Xaman app to sign in',
      uuid: payload.uuid,
      deepLink: payload.deepLink,
      qrUrl: payload.qrUrl
    });
  } catch (error) {
    console.error('XUMM login error:', error.message);
    res.status(500).json({ error: 'Failed to create Xaman sign-in request.' });
  }
});

// ============================================
// POST /api/auth/xumm/verify
// ============================================
// Flutter calls this AFTER user returns from Xaman app
// Checks if user signed, gets wallet address, creates/finds user
router.post('/verify', async (req, res) => {
  try {
    const { uuid } = req.body;

    if (!uuid) {
      return res.status(400).json({ error: 'uuid is required.' });
    }

    // Check if user signed the payload in Xaman
    const result = await xummService.verifyPayload(uuid);

    if (!result.signed) {
      return res.status(401).json({
        error: 'Sign-in not completed.',
        reason: result.reason
      });
    }

    const walletAddress = result.walletAddress;
    console.log(`✅ Xaman sign-in verified: ${walletAddress}`);

    // Find or create user with this wallet address
    let user = await User.findByWeb3AuthOrEmail(
      `xaman|${walletAddress}`,
      `${walletAddress.substring(0, 8)}@xrpl.wallet`
    );

    if (user) {
      // Existing user — update wallet address
      user = await User.updateWeb3AuthInfo(user.id, {
        name: user.name,
        walletAddress: walletAddress,
        profileImage: user.profile_image,
        web3authSub: `xaman|${walletAddress}`
      });
      console.log(`🔑 Existing user logged in via Xaman: ${walletAddress}`);
    } else {
      // New user — create account
      user = await User.createWeb3AuthUser({
        email: `${walletAddress.substring(0, 8)}@xrpl.wallet`,
        name: 'Xaman User',
        role: 'driver',
        walletAddress: walletAddress,
        web3authSub: `xaman|${walletAddress}`,
        profileImage: ''
      });
      console.log(`🆕 New user registered via Xaman: ${walletAddress}`);
    }

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    res.json({
      message: 'Xaman login successful!',
      token,
      user,
      walletAddress
    });
  } catch (error) {
    console.error('XUMM verify error:', error.message);
    res.status(500).json({ error: 'Failed to verify Xaman sign-in.' });
  }
});

module.exports = router;