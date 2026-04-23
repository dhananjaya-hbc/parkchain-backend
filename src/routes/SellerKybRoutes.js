const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/AuthMiddleware');
const roleMiddleware = require('../middleware/RoleMiddleware');
const SellerKybController = require('../controllers/SellerKybController');

// 1. GET /api/seller/kyb/my-requests
// Returns approved KYBs with spotCreated so the frontend can show the correct button state.
router.get('/my-requests', authMiddleware, roleMiddleware('seller', 'driver'), SellerKybController.getMyRequests);

// 2. GET /api/seller/kyb/approved
// Returns approved KYBs with spotCreated for the spot creation flow.
router.get('/approved', authMiddleware, roleMiddleware('seller', 'driver'), SellerKybController.getApprovedRequests);

// 3. GET /api/seller/kyb/:kybId
// Returns a single approved KYB for autofill.
router.get('/:kybId', authMiddleware, roleMiddleware('seller', 'driver'), SellerKybController.getKybById);

module.exports = router;
