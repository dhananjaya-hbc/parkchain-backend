// src/routes/PaymentRoutes.js (renamed from Web3Routes.js)
// ============================================
// PAYMENT / XRPL ROUTES
// ============================================
//
// Route table:
//   POST   /api/payments/generate-wallet       → Generate XRPL wallet
//   GET    /api/payments/balance               → Get user's XRP balance
//   POST   /api/payments/process               → Process booking payment ⭐
//   GET    /api/payments/transactions          → Transaction history (ADMIN)
//   GET    /api/payments/seller/transactions   → Seller's transaction history ⭐ NEW
//   GET    /api/payments/verify/:txHash        → Verify TX on blockchain
//   GET    /api/payments/admin/balance         → Admin wallet + earnings

const router = require('express').Router();
const PaymentController = require('../controllers/PaymentController');
const authMiddleware = require('../middleware/AuthMiddleware');
const roleMiddleware = require('../middleware/RoleMiddleware');

// All payment routes require authentication
router.use(authMiddleware);

// Wallet management (any authenticated user)
router.post('/generate-wallet', PaymentController.generateWallet);
router.get('/balance', PaymentController.getBalance);

// Payment processing (driver only)
router.post('/process', roleMiddleware('driver'), PaymentController.processPayment);

// Transaction queries
router.get('/transactions', roleMiddleware('admin'), PaymentController.getTransactions); // Admin only
router.get('/seller/transactions', roleMiddleware('seller'), PaymentController.getSellerTransactions); // ⭐ NEW - Seller only
router.get('/verify/:txHash', PaymentController.verifyTransaction); // Any authenticated user

// Admin only
router.get('/admin/balance', roleMiddleware('admin'), PaymentController.getAdminBalance);

module.exports = router;