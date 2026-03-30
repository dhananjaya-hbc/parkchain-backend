// src/controllers/AuthController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const xrplService = require('../services/XrplService');  // ⭐ ADD THIS
require('dotenv').config();

const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// POST /api/auth/web3auth — Register/login driver or seller
const web3AuthLogin = async (req, res) => {
  try {
    const { email, name, wallet_address, web3auth_sub, profile_image, role } = req.body;

    if (!email || !name || !web3auth_sub) {
      return res.status(400).json({
        error: 'email, name, and web3auth_sub are required from Web3Auth.'
      });
    }

    const userRole = role === 'seller' ? 'seller' : 'driver';

    let user = await User.findByWeb3AuthOrEmail(web3auth_sub, email);

    if (user) {
      // Existing user - update info
      user = await User.updateWeb3AuthInfo(user.id, {
        name,
        walletAddress: wallet_address,
        profileImage: profile_image,
        web3authSub: web3auth_sub
      });
      console.log(`🔑 Existing ${user.role} logged in: ${user.email}`);

      // ⭐ Check if existing user needs XRPL wallet
      const walletDetails = await User.getWalletDetails(user.id);
      if (!walletDetails || !walletDetails.wallet_address || 
          !walletDetails.wallet_seed || !walletDetails.wallet_address.startsWith('r')) {
        console.log(`🔑 Existing user missing XRPL wallet, generating...`);
        try {
          const wallet = await xrplService.generateWallet();
          await User.updateWallet(user.id, wallet.address, wallet.seed);
          console.log(`✅ XRPL wallet generated for existing user: ${wallet.address}`);
        } catch (walletError) {
          console.error(`⚠️ Wallet generation failed for existing user: ${walletError.message}`);
        }
      }
    } else {
      // New user - create account
      user = await User.createWeb3AuthUser({
        email,
        name,
        role: userRole,
        walletAddress: wallet_address,
        web3authSub: web3auth_sub,
        profileImage: profile_image
      });
      console.log(`🆕 New ${user.role} registered: ${user.email}`);

      // ⭐ Auto-generate XRPL wallet for new user
      console.log(`🔑 Generating XRPL wallet for new ${userRole}...`);
      try {
        const wallet = await xrplService.generateWallet();
        await User.updateWallet(user.id, wallet.address, wallet.seed);
        user.wallet_address = wallet.address;
        console.log(`✅ XRPL wallet generated: ${wallet.address}`);
        console.log(`💰 Funded with test XRP`);
      } catch (walletError) {
        console.error(`⚠️ Auto wallet generation failed: ${walletError.message}`);
        // Don't block registration - user can generate later
      }
    }

    const token = generateToken(user.id, user.role);

    res.status(200).json({
      message: 'Authentication successful',
      token,
      user
    });
  } catch (error) {
    console.error('Web3Auth login error:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'An account with this email already exists.'
      });
    }
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
};

// Keep other functions unchanged
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.'
      });
    }

    const admin = await User.findAdminByEmail(email);

    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!admin.password) {
      return res.status(401).json({ error: 'Admin account not properly configured.' });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(admin.id, admin.role);

    console.log(`👑 Admin logged in: ${admin.email}`);

    res.status(200).json({
      message: 'Admin login successful',
      token,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        wallet_address: admin.wallet_address,
        created_at: admin.created_at
      }
    });
  } catch (error) {
    console.error('Admin login error:', error.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

const getMe = async (req, res) => {
  try {
    res.json({
      user: req.user,
      authType: req.authType
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user info.' });
  }
};

module.exports = { web3AuthLogin, adminLogin, getMe };