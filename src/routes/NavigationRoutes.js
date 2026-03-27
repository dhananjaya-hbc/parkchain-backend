const express = require('express');
const router = express.Router();
const NavigationController = require('../controllers/NavigationController');

// The correct import for your AuthMiddleware
const authMiddleware = require('../middleware/AuthMiddleware'); 

// GET /api/navigation/route?origin=lat,lng&destination=lat,lng
// We use authMiddleware so only logged-in users (Drivers) can fetch routes
router.get('/route', authMiddleware, NavigationController.getRoute);

module.exports = router;