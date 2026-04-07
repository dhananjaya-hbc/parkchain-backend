const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/AuthMiddleware');
const roleMiddleware = require('../middleware/RoleMiddleware');
const SellerKybController = require('../controllers/SellerKybController');

// 1. GET /api/seller/kyb/my-requests
// Note: We're allowing 'driver' and 'seller' here, because their role is still 'driver' 
// while their first KYB request is still in 'pending' status!
router.get('/my-requests', authMiddleware, roleMiddleware('seller', 'driver'), SellerKybController.getMyRequests);

module.exports = router;
