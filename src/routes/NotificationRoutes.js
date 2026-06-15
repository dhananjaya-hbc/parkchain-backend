const router = require('express').Router();
const FcmTokenController = require('../controllers/FcmTokenController');
const NotificationController = require('../controllers/NotificationController');
const authMiddleware = require('../middleware/AuthMiddleware'); 

// import express from 'express';
// import FcmTokenController from '../controllers/Fcmtokencontroller.js';
// import NotificationController from '../controllers/NotificationController.js';
// import { authenticate } from '../middleware/AuthMiddleware.js';

router.use(authMiddleware);

// ─── FCM Token Routes ────────────────────────────────────────────────────────

// Register or refresh FCM token
router.post('/token', FcmTokenController.register);

// Remove a specific token (logout from device)
router.delete('/token', FcmTokenController.remove);

// List active tokens (useful for debugging)
router.get('/tokens', FcmTokenController.list);

// ─── Notification Retrieval Routes ──────────────────────────────────────────

// Get all notifications for the user (with pagination)
// ?limit=20&offset=0&read=true/false (optional)
router.get('/', NotificationController.getNotifications);

// Get count of unread notifications
router.get('/unread', NotificationController.getUnreadCount);

// Mark a specific notification as read
router.put('/:id/read', NotificationController.markAsRead);

// Mark all notifications as read
router.put('/read-all', NotificationController.markAllAsRead);

// Delete a specific notification
router.delete('/:id', NotificationController.deleteNotification);

// Delete all notifications
router.delete('/', NotificationController.deleteAllNotifications);

module.exports = router;