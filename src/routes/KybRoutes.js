const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/AuthMiddleware');
const KybController = require('../controllers/KybController');
const { upload } = require('../config/cloudinary');

// 1. Submit KYB for Business Account (Seller adding a spot)
// Expected Request payload:
// form-data fields: entityName, address, googleMapsLink, spotType
// file upload under field name: document
router.post('/', authMiddleware, upload.single('document'), KybController.submitKyb);

module.exports = router;
