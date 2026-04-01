// src/routes/PaymentRoutes.js
// ============================================
// PAYMENT / XRPL ROUTES (Xaman-only)
// ============================================
//
// Payment processing is now handled via XummRoutes.js:
//   POST /api/auth/xumm/create-payment  → Driver signs in Xaman app
//   POST /api/auth/xumm/verify-payment  → Backend verifies & splits 80/20
//
// This file handles:
//   GET    /api/payments/balance               → Get user's XRP balance
//   GET    /api/payments/transactions          → Transaction history (ADMIN)
//   GET    /api/payments/seller/transactions   → Seller's transaction history
//   GET    /api/payments/verify/:txHash        → Verify TX on blockchain
//   GET    /api/payments/admin/balance         → Admin wallet + earnings

const router = require('express').Router();
const PaymentController = require('../controllers/PaymentController');
const authMiddleware = require('../middleware/AuthMiddleware');
const roleMiddleware = require('../middleware/RoleMiddleware');

// All payment routes require authentication
router.use(authMiddleware);

// Balance check (any authenticated user — drivers, sellers, admin)
router.get('/balance', PaymentController.getBalance);

// Transaction queries
router.get('/transactions', roleMiddleware('admin'), PaymentController.getTransactions);
router.get('/seller/transactions', roleMiddleware('seller'), PaymentController.getSellerTransactions);
router.get('/verify/:txHash', PaymentController.verifyTransaction);

// Admin only
router.get('/admin/balance', roleMiddleware('admin'), PaymentController.getAdminBalance);

module.exports = router;
