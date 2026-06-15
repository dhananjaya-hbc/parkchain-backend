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
//   PUT    /api/spots/:id/admin-toggle → Toggle active status (admin only)
//   DELETE /api/spots/:id/reject   → Reject spot (admin only)

const router = require('express').Router();
const SpotController = require('../controllers/SpotController');
const authMiddleware = require('../middleware/AuthMiddleware');
const roleMiddleware = require('../middleware/RoleMiddleware');
const { spotUpload } = require('../config/cloudinary');

// Public/authenticated routes
router.get('/', authMiddleware, SpotController.getSpots);
router.get('/pending', authMiddleware, roleMiddleware('admin'), SpotController.getPendingSpots);
router.get('/:id', authMiddleware, SpotController.getSpotById);

// Seller routes
router.post('/', authMiddleware, roleMiddleware('seller'), spotUpload.array('images'), SpotController.createSpot);
router.put('/:id', authMiddleware, roleMiddleware('seller'), spotUpload.array('images'), SpotController.updateSpot);
router.put('/:id/toggle', authMiddleware, roleMiddleware('seller'), SpotController.toggleAvailability);
router.delete('/:id', authMiddleware, roleMiddleware('seller'), SpotController.deleteSpot);

// Admin routes
router.put('/:id/approve', authMiddleware, roleMiddleware('admin'), SpotController.approveSpot);
router.put('/:id/admin-toggle', authMiddleware, roleMiddleware('admin'), SpotController.adminToggleSpot);
router.delete('/:id/reject', authMiddleware, roleMiddleware('admin'), SpotController.rejectSpot);

module.exports = router;