// ============================================
// NOW: Only verifies our own JWT tokens
// ============================================
const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

const verifyJWT = (token) => {
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

    // Verify our JWT (issued during Xaman login or admin login)
    const jwtPayload = verifyJWT(token);

    if (!jwtPayload) {
      return res.status(401).json({
        error: 'Invalid or expired token. Please log in again.'
      });
    }

    const user = await User.findById(jwtPayload.userId);

    if (!user) {
      return res.status(401).json({
        error: 'User not found. Token may be invalid.'
      });
    }

    req.user = user;
    req.authType = user.auth_type || 'jwt'; // 'xaman' for drivers/sellers, 'jwt' for admin
    return next();

  } catch (error) {
    console.error('Auth middleware error:', error.message, error.stack);
    return res.status(401).json({ error: 'Authentication failed: ' + error.message });
  }
};

module.exports = authMiddleware;