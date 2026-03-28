const express = require('express');
const router = express.Router();
const kycController = require('../controllers/SellerKycController');

// If you have authentication middleware, you should add it here to protect these routes.
// Example: const { requireAuth, requireAdmin } = require('../middleware/AuthMiddleware');

// 1. Submit or Update KYC Application
// POST /api/seller/kyc
router.post('/kyc', kycController.submitKyc);

// 2. Get All Pending KYC Applications (For Admin)
// GET /api/seller/kyc?status=pending_review
router.get('/kyc', kycController.getAllKycApplications);

// 2b. Get KYC Status by Email (MUST be before /:userId to avoid path matching issues)
// GET /api/seller/kyc/status?email=...
router.get('/kyc/status', kycController.getKycStatusByEmail);

// 3. Get Specific KYC Data by User ID
// GET /api/seller/kyc/:userId
router.get('/kyc/:userId', kycController.getKycByUserId);

// 4. Update KYC Status (Approve/Reject - For Admin)
// PATCH /api/seller/kyc/:userId/status
router.patch('/kyc/:userId/status', kycController.updateKycStatus);

module.exports = router;
