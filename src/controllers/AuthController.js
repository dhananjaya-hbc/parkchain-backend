// src/controllers/AuthController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// POST /api/auth/xaman — Register/login via Xaman wallet
const xamanLogin = async (req, res) => {
  try {
    const { wallet_address, role } = req.body;

    if (!wallet_address) {
      return res.status(400).json({
        error: 'wallet_address is required from Xaman.'
      });
    }

    const userRole = role === 'seller' ? 'seller' : 'driver';

    let user = await User.findByWalletAddress(wallet_address);

    if (user) {
      console.log(`🔑 Existing ${user.role} logged in via Xaman: ${user.wallet_address}`);
    } else {
      user = await User.createXamanUser({
        walletAddress: wallet_address,
        role: userRole
      });
      console.log(`🆕 New ${user.role} registered via Xaman: ${user.wallet_address}`);
    }

    const token = generateToken(user.id, user.role);

    res.status(200).json({
      message: 'Xaman authentication successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        wallet_address: user.wallet_address,
        profile_image: user.profile_image,
        auth_type: user.auth_type,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Xaman login error:', error.message);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
};

// POST /api/auth/admin/login — Admin login
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

module.exports = { xamanLogin, adminLogin, getMe };