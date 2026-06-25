// src/routes/PaymentRoutes.js

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
router.get('/seller/earnings-chart', roleMiddleware('seller'), PaymentController.getSellerEarningsChart);
router.get('/verify/:txHash', PaymentController.verifyTransaction);

// Admin only
router.get('/admin/balance', roleMiddleware('admin'), PaymentController.getAdminBalance);
router.get('/admin/revenue-chart', roleMiddleware('admin'), PaymentController.getAdminRevenueChart); // Add this line

module.exports = router;
