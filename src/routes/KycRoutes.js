const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/AuthMiddleware');
const KycController = require('../controllers/KycController');

// 1. Create Didit Session (Must be authenticated)
router.post('/create-didit-session', authMiddleware, KycController.createSession);

// 2. Didit Webhook Endpoint (Public, verified via signature/secret)
// We typically use express.json() which is already active globally in app.js
router.post('/webhooks/didit', KycController.handleWebhook);

module.exports = router;
