// src/middleware/AuthMiddleware.js
// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
//
// This middleware handles TWO types of authentication:
//
// 1. WEB3AUTH TOKEN (for drivers & sellers)
//    - Token issued by Web3Auth (not by us)
//    - Verified using Web3Auth's public keys (JWKS)
//    - Contains: email, wallet info, verifier details
//
// 2. OUR JWT TOKEN (for admin only)
//    - Token issued by OUR backend
//    - Verified using our JWT_SECRET
//    - Contains: userId, role
//
// How does the middleware know which type?
//    - It tries Web3Auth verification first
//    - If that fails, it tries our JWT verification
//    - If both fail, the request is rejected

const jwt = require('jsonwebtoken');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const { query } = require('../config/db');
require('dotenv').config();

// Create JWKS (JSON Web Key Set) verifier for Web3Auth
// This fetches Web3Auth's public keys to verify their tokens
// The keys are cached automatically by the jose library
const jwks = createRemoteJWKSet(
  new URL(process.env.WEB3AUTH_JWKS_URL || 'https://api-auth.web3auth.io/jwks')
);

// ============================================
// VERIFY WEB3AUTH TOKEN
// ============================================
// Returns the decoded token payload if valid, null if invalid
const verifyWeb3AuthToken = async (token) => {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ['ES256']  // Web3Auth uses ES256 algorithm
    });

    // Verify the token is for OUR app (audience check)
    // This prevents tokens from other Web3Auth apps being used
    if (process.env.WEB3AUTH_CLIENT_ID) {
      const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audience.includes(process.env.WEB3AUTH_CLIENT_ID)) {
        console.log('Web3Auth token audience mismatch');
        return null;
      }
    }

    return payload;
  } catch (error) {
    // Not a valid Web3Auth token — that's OK, might be our JWT
    return null;
  }
};

// ============================================
// VERIFY OUR JWT TOKEN (admin)
// ============================================
const verifyOurJWT = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// ============================================
// MAIN MIDDLEWARE
// ============================================
const authMiddleware = async (req, res, next) => {
  try {
    // STEP 1: Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided. Please log in first.'
      });
    }

    const token = authHeader.split(' ')[1];

    // STEP 2: Try Web3Auth verification first (drivers & sellers)
    const web3AuthPayload = await verifyWeb3AuthToken(token);

    if (web3AuthPayload) {
      // Token is from Web3Auth!
      // Find the user in our database by email or web3auth_sub
      const email = web3AuthPayload.email;
      const web3authSub = web3AuthPayload.sub;

      let result;
      if (web3authSub) {
        result = await query(
          `SELECT id, email, name, phone, role, wallet_address,
                  web3auth_sub, profile_image, is_verified, created_at
           FROM users
           WHERE web3auth_sub = $1 OR email = $2`,
          [web3authSub, email]
        );
      } else if (email) {
        result = await query(
          `SELECT id, email, name, phone, role, wallet_address,
                  web3auth_sub, profile_image, is_verified, created_at
           FROM users
           WHERE email = $1`,
          [email]
        );
      }

      if (!result || result.rows.length === 0) {
        return res.status(401).json({
          error: 'User not found. Please register first via /api/auth/web3auth'
        });
      }

      req.user = result.rows[0];
      req.authType = 'web3auth';  // So routes know which auth was used
      return next();
    }

    // STEP 3: Try our JWT verification (admin)
    const jwtPayload = verifyOurJWT(token);

    if (jwtPayload) {
      // Token is our JWT!
      const result = await query(
        `SELECT id, email, name, phone, role, wallet_address,
                web3auth_sub, profile_image, is_verified, created_at
         FROM users
         WHERE id = $1`,
        [jwtPayload.userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: 'User not found. Token may be invalid.'
        });
      }

      req.user = result.rows[0];
      req.authType = 'jwt';
      return next();
    }

    // STEP 4: Both verifications failed
    return res.status(401).json({
      error: 'Invalid token. Please log in again.'
    });

  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({ error: 'Authentication failed.' });
  }
};

module.exports = authMiddleware;