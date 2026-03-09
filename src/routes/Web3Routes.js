// src/routes/Web3Routes.js
// ============================================
// PAYMENT / XRPL ROUTES
// ============================================
//
// Route table:
//   POST   /api/payments/generate-wallet  → Generate XRPL wallet
//   GET    /api/payments/balance          → Get user's XRP balance
//   POST   /api/payments/process          → Process booking payment ⭐
//   GET    /api/payments/transactions     → Transaction history
//   GET    /api/payments/verify/:txHash   → Verify TX on blockchain
//   GET    /api/payments/admin/balance    → Admin wallet + earnings

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

// Transaction queries (any authenticated user)
router.get('/transactions', PaymentController.getTransactions);
router.get('/verify/:txHash', PaymentController.verifyTransaction);

// Admin only
router.get('/admin/balance', roleMiddleware('admin'), PaymentController.getAdminBalance);

module.exports = router;