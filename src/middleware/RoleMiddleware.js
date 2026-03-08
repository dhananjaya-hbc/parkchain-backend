// src/middleware/RoleMiddleware.js
// ============================================
// ROLE-BASED ACCESS CONTROL MIDDLEWARE
// ============================================
//
// This runs AFTER AuthMiddleware (so req.user already exists)
// It checks if the user has the right role to access a route
//
// Usage in routes:
//   router.get('/admin-only', authMiddleware, roleMiddleware('admin'), handler)
//   router.get('/sellers-only', authMiddleware, roleMiddleware('seller'), handler)
//   router.get('/both', authMiddleware, roleMiddleware('driver', 'seller'), handler)
//
// Why is this a function that RETURNS a function?
// ------------------------------------------------
// We need to pass the allowed roles as arguments.
// But Express middleware must be a function(req, res, next).
// So we create a "factory function" that takes roles and
// returns the actual middleware function.
// This pattern is called a "closure" in JavaScript.

const roleMiddleware = (...allowedRoles) => {
  // This is the actual middleware function that Express calls
  return (req, res, next) => {
    // Check if AuthMiddleware ran first
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required before checking role.' 
      });
    }

    // Check if user's role is in the allowed list
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Access denied. This route requires: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}` 
      });
    }

    // User has the right role, continue!
    next();
  };
};

module.exports = roleMiddleware;