// src/routes/XummRoutes.js

const router         = require('express').Router();
const XummController = require('../controllers/XummController');

// ── Login routes ──────────────────────────────────────
router.post('/login',  XummController.login);
router.post('/verify', XummController.verify);

// ── Payment routes ────────────────────────────────────
router.post('/create-payment', XummController.createPayment);
router.post('/verify-payment', XummController.verifyPayment);

module.exports = router;