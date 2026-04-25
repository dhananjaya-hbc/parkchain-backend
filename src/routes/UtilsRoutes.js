// src/routes/UtilsRoutes.js
const express = require('express');
const router = express.Router();
const UtilsController = require('../controllers/UtilsController');

// POST /api/utils/map-link-to-coords
router.post('/map-link-to-coords', UtilsController.convertMapLinkToCoords);

module.exports = router;
