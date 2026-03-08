// src/controllers/AuthController.js
// ============================================
// AUTHENTICATION CONTROLLER
// ============================================
//
// Two auth flows:
//   1. Web3Auth (drivers & sellers) → No JWT from us, just register/update user
//   2. Admin login (email + password) → Returns our JWT

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
require('dotenv').config();

// Generate JWT — ONLY for admin
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ============================================
// 1. WEB3AUTH REGISTER/LOGIN (Drivers & Sellers)
// ============================================
// POST /api/auth/web3auth
//
// Called ONCE when user first logs in through Web3Auth on frontend.
// This creates their account in our database (or updates if exists).
//
// The frontend handles all subsequent auth using Web3Auth's own idToken.
// We do NOT return a JWT here — the frontend uses Web3Auth's token.
//
// Request body (sent from frontend after Web3Auth login):
// {
//   "email": "john@gmail.com",
//   "name": "John Doe",
//   "wallet_address": "rN7n3473SaZBCG...",
//   "web3auth_sub": "google|1234567890",
//   "profile_image": "https://...",
//   "role": "driver"
// }
const web3AuthLogin = async (req, res) => {
  try {
    const { email, name, wallet_address, web3auth_sub, profile_image, role } = req.body;

    // Validate required fields
    if (!email || !name || !web3auth_sub) {
      return res.status(400).json({
        error: 'email, name, and web3auth_sub are required from Web3Auth.'
      });
    }

    // Only driver or seller allowed (NOT admin)
    const userRole = role === 'seller' ? 'seller' : 'driver';

    // Check if user already exists
    let result = await query(
      'SELECT * FROM users WHERE web3auth_sub = $1 OR email = $2',
      [web3auth_sub, email]
    );

    let user;

    if (result.rows.length > 0) {
      // ---- EXISTING USER: Update their info ----
      user = result.rows[0];

      await query(
        `UPDATE users
         SET name = $1,
             wallet_address = COALESCE($2, wallet_address),
             profile_image = COALESCE($3, profile_image),
             web3auth_sub = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [name, wallet_address, profile_image, web3auth_sub, user.id]
      );

      // Fetch updated user
      const updated = await query(
        `SELECT id, email, name, phone, role, wallet_address,
                web3auth_sub, profile_image, is_verified, created_at
         FROM users WHERE id = $1`,
        [user.id]
      );
      user = updated.rows[0];

      console.log(`🔑 Existing ${user.role} logged in: ${user.email}`);
    } else {
      // ---- NEW USER: Create account (NO password!) ----
      const insertResult = await query(
        `INSERT INTO users (email, name, role, wallet_address, web3auth_sub, profile_image)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, name, phone, role, wallet_address,
                   web3auth_sub, profile_image, is_verified, created_at`,
        [email, name, userRole, wallet_address, web3auth_sub, profile_image]
      );
      user = insertResult.rows[0];

      console.log(`🆕 New ${user.role} registered: ${user.email}`);
    }

    // NO JWT returned! Frontend uses Web3Auth's idToken directly.
    res.status(200).json({
      message: 'User registered/updated successfully',
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

// ============================================
// 2. ADMIN LOGIN (Email + Password → JWT)
// ============================================
// POST /api/auth/admin/login
//
// Only admin uses this. Returns OUR JWT.
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.'
      });
    }

    // Find admin
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND role = $2',
      [email, 'admin']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    const admin = result.rows[0];

    if (!admin.password) {
      return res.status(401).json({
        error: 'Admin account not properly configured.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    // Generate OUR JWT (only for admin)
    const token = generateToken(admin.id, admin.role);

    console.log(`👑 Admin logged in: ${admin.email}`);

    res.status(200).json({
      message: 'Admin login successful',
      token,  // ← Only admin gets a JWT from us
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        created_at: admin.created_at
      }
    });

  } catch (error) {
    console.error('Admin login error:', error.message);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

// ============================================
// 3. GET CURRENT USER
// ============================================
// GET /api/auth/me
// Works with BOTH Web3Auth token and our JWT
const getMe = async (req, res) => {
  try {
    res.json({
      user: req.user,
      authType: req.authType  // 'web3auth' or 'jwt'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user info.' });
  }
};

module.exports = {
  web3AuthLogin,
  adminLogin,
  getMe
};