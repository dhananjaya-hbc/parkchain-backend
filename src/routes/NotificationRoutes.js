const router = require('express').Router();
const FcmTokenController = require('../controllers/FcmTokenController');
const authMiddleware = require('../middleware/AuthMiddleware'); 

// import express from 'express';
// import FcmTokenController from '../controllers/Fcmtokencontroller.js';
// import { authenticate } from '../middleware/AuthMiddleware.js';

router.use(authMiddleware);


// Register or refresh FCM token
router.post('/token', FcmTokenController.register);

// Remove a specific token (logout from device)
router.delete('/token', FcmTokenController.remove);

// List active tokens (useful for debugging)
router.get('/tokens', FcmTokenController.list);

module.exports = router;