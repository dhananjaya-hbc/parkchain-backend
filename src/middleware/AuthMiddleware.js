// src/middleware/AuthMiddleware.js
const jwt = require('jsonwebtoken');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const User = require('../models/User');
require('dotenv').config();

const jwks = createRemoteJWKSet(
  new URL(process.env.WEB3AUTH_JWKS_URL || 'https://api-auth.web3auth.io/jwks')
);

const verifyWeb3AuthToken = async (token) => {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ['ES256']
    });

    if (process.env.WEB3AUTH_CLIENT_ID) {
      const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!audience.includes(process.env.WEB3AUTH_CLIENT_ID)) {
        return null;
      }
    }

    return payload;
  } catch (error) {
    return null;
  }
};

const verifyOurJWT = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided. Please log in first.'
      });
    }

    const token = authHeader.split(' ')[1];

    // Try Web3Auth first (drivers & sellers)
    const web3AuthPayload = await verifyWeb3AuthToken(token);

    if (web3AuthPayload) {
      const email = web3AuthPayload.email;
      const web3authSub = web3AuthPayload.sub;

      let user = null;
      if (web3authSub) {
        user = await User.findByWeb3AuthSub(web3authSub);
      }
      if (!user && email) {
        user = await User.findByEmail(email);
      }

      if (!user) {
        return res.status(401).json({
          error: 'User not found. Please register first via /api/auth/web3auth'
        });
      }

      req.user = user;
      req.authType = 'web3auth';
      return next();
    }

    // Try our JWT (admin)
    const jwtPayload = verifyOurJWT(token);

    if (jwtPayload) {
      const user = await User.findById(jwtPayload.userId);

      if (!user) {
        return res.status(401).json({
          error: 'User not found. Token may be invalid.'
        });
      }

      req.user = user;
      req.authType = 'jwt';
      return next();
    }

    return res.status(401).json({
      error: 'Invalid token. Please log in again.'
    });

  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({ error: 'Authentication failed.' });
  }
};

module.exports = authMiddleware;