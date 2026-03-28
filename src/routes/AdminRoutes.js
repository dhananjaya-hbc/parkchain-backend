const express = require('express');
const router = express.Router();
const adminController = require('../controllers/AdminController');

// GET /api/admin/verifications
router.get('/verifications', adminController.getVerifications);

// GET /api/admin/verifications/:id
router.get('/verifications/:id', adminController.getVerificationById);

module.exports = router;
