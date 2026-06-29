// src/routes/ReviewRoutes.js
// ============================================
// REVIEW ROUTES
// ============================================

const router = require('express').Router();
const ReviewController = require('../controllers/ReviewController');
const authMiddleware = require('../middleware/AuthMiddleware');
const roleMiddleware = require('../middleware/RoleMiddleware');

// ─── All routes require authentication ────────────────────────────────────

router.use(authMiddleware);

// ─── PUBLIC ROUTES (authenticated users) ─────────────────────────────────

// POST - Create a review (driver can create after booking)
router.post('/', ReviewController.createReview);

// GET - Get a specific review by ID
router.get('/:id', ReviewController.getReviewById);

// GET - Get reviews for a specific spot (public, shows spot ratings)
router.get('/spot/:spotId', ReviewController.getReviewsBySpot);
router.get('/booking/:bookingId', ReviewController.getReviewByBooking);

// ─── DRIVER ROUTES ───────────────────────────────────────────────────────

// GET - Get all reviews created by the driver
router.get('/driver/me', roleMiddleware('driver'), ReviewController.getDriverReviews);

// PUT - Update a review
router.put('/:id', ReviewController.updateReview);

// DELETE - Delete a review
router.delete('/:id', ReviewController.deleteReview);

// ─── SELLER ROUTES ──────────────────────────────────────────────────────

// GET - Get all reviews for seller's spots
router.get('/seller/me', roleMiddleware('seller'), ReviewController.getSellerReviews);

// ─── ADMIN ROUTES ──────────────────────────────────────────────────────

// GET - Get all reviews (admin only)
router.get('/', roleMiddleware('admin'), ReviewController.getAllReviews);

module.exports = router;
