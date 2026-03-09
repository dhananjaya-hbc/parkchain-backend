// src/routes/SpotRoutes.js
// ============================================
// SPOT ROUTES
// ============================================
//
// Route table:
//   GET    /api/spots              → List spots (role-based view)
//   GET    /api/spots/pending      → Pending approval (admin only)
//   GET    /api/spots/:id          → Spot details
//   POST   /api/spots              → Create spot (seller only)
//   PUT    /api/spots/:id          → Update spot (seller only)
//   PUT    /api/spots/:id/toggle   → Toggle availability (seller only)
//   PUT    /api/spots/:id/approve  → Approve spot (admin only)
//   DELETE /api/spots/:id/reject   → Reject spot (admin only)

const router = require('express').Router();
const SpotController = require('../controllers/SpotController');
const authMiddleware = require('../middleware/AuthMiddleware');
const roleMiddleware = require('../middleware/RoleMiddleware');

// Public/authenticated routes
router.get('/', authMiddleware, SpotController.getSpots);
router.get('/pending', authMiddleware, roleMiddleware('admin'), SpotController.getPendingSpots);
router.get('/:id', authMiddleware, SpotController.getSpotById);

// Seller routes
router.post('/', authMiddleware, roleMiddleware('seller'), SpotController.createSpot);
router.put('/:id', authMiddleware, roleMiddleware('seller'), SpotController.updateSpot);
router.put('/:id/toggle', authMiddleware, roleMiddleware('seller'), SpotController.toggleAvailability);

// Admin routes
router.put('/:id/approve', authMiddleware, roleMiddleware('admin'), SpotController.approveSpot);
router.delete('/:id/reject', authMiddleware, roleMiddleware('admin'), SpotController.rejectSpot);

module.exports = router;