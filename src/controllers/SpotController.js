// src/controllers/SpotController.js
// ============================================
// SPOT CONTROLLER
// ============================================
// Handles HTTP requests for parking spots

const Spot = require('../models/Spot');

// ============================================
// POST /api/spots — Create a new spot (seller only)
// ============================================
const createSpot = async (req, res) => {
  try {
    const {
      title, description, address,
      latitude, longitude, pricePerHour,
      imageUrls, totalSlots
    } = req.body;

    // Validate required fields
    if (!title || !address || !latitude || !longitude || !pricePerHour) {
      return res.status(400).json({
        error: 'Required fields: title, address, latitude, longitude, pricePerHour'
      });
    }

    // Validate numeric fields
    if (isNaN(latitude) || isNaN(longitude) || isNaN(pricePerHour)) {
      return res.status(400).json({
        error: 'latitude, longitude, and pricePerHour must be numbers'
      });
    }

    if (pricePerHour <= 0) {
      return res.status(400).json({
        error: 'pricePerHour must be greater than 0'
      });
    }

    const spot = await Spot.create({
      ownerId: req.user.id,  // From AuthMiddleware
      title,
      description,
      address,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      pricePerHour: parseFloat(pricePerHour),
      imageUrls,
      totalSlots: parseInt(totalSlots) || 1
    });

    console.log(`🅿️ New spot created: "${title}" by ${req.user.name}`);

    res.status(201).json({
      message: 'Spot created successfully. Waiting for admin approval.',
      spot
    });

  } catch (error) {
    console.error('Create spot error:', error.message);
    res.status(500).json({ error: 'Failed to create spot.' });
  }
};

// ============================================
// GET /api/spots — Get spots (different views per role)
// ============================================
const getSpots = async (req, res) => {
  try {
    // If user is authenticated, show role-specific view
    // If not authenticated (public), show available spots only
    if (req.user && req.user.role === 'admin') {
      // Admin sees ALL spots
      const spots = await Spot.findAll();
      return res.json({ spots, total: spots.length });
    }

    if (req.user && req.user.role === 'seller') {
      // Seller sees only THEIR spots
      const spots = await Spot.findByOwner(req.user.id);
      return res.json({ spots, total: spots.length });
    }

    // Drivers and public see only available + approved spots
    const spots = await Spot.findAvailable();
    res.json({ spots, total: spots.length });

  } catch (error) {
    console.error('Get spots error:', error.message);
    res.status(500).json({ error: 'Failed to fetch spots.' });
  }
};

// ============================================
// GET /api/spots/:id — Get spot details
// ============================================
const getSpotById = async (req, res) => {
  try {
    const spot = await Spot.findById(req.params.id);

    if (!spot) {
      return res.status(404).json({ error: 'Spot not found.' });
    }

    res.json({ spot });

  } catch (error) {
    console.error('Get spot error:', error.message);
    res.status(500).json({ error: 'Failed to fetch spot.' });
  }
};

// ============================================
// PUT /api/spots/:id — Update spot (seller only)
// ============================================
const updateSpot = async (req, res) => {
  try {
    const spot = await Spot.update(req.params.id, req.user.id, req.body);

    if (!spot) {
      return res.status(404).json({
        error: 'Spot not found or you do not own this spot.'
      });
    }

    res.json({ message: 'Spot updated.', spot });

  } catch (error) {
    console.error('Update spot error:', error.message);
    res.status(500).json({ error: 'Failed to update spot.' });
  }
};

// ============================================
// PUT /api/spots/:id/toggle — Toggle availability (seller)
// ============================================
const toggleAvailability = async (req, res) => {
  try {
    const spot = await Spot.toggleAvailability(req.params.id, req.user.id);

    if (!spot) {
      return res.status(404).json({
        error: 'Spot not found or you do not own this spot.'
      });
    }

    res.json({
      message: `Spot is now ${spot.is_available ? 'available' : 'unavailable'}.`,
      spot
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle availability.' });
  }
};

// ============================================
// PUT /api/spots/:id/approve — Approve spot (admin only)
// ============================================
const approveSpot = async (req, res) => {
  try {
    const spot = await Spot.approve(req.params.id);

    if (!spot) {
      return res.status(404).json({ error: 'Spot not found.' });
    }

    console.log(`✅ Spot approved: "${spot.title}"`);

    res.json({ message: 'Spot approved successfully.', spot });

  } catch (error) {
    res.status(500).json({ error: 'Failed to approve spot.' });
  }
};

// ============================================
// DELETE /api/spots/:id/reject — Reject spot (admin only)
// ============================================
const rejectSpot = async (req, res) => {
  try {
    const spot = await Spot.reject(req.params.id);

    if (!spot) {
      return res.status(404).json({ error: 'Spot not found.' });
    }

    console.log(`❌ Spot rejected: "${spot.title}"`);

    res.json({ message: 'Spot rejected and removed.', spot });

  } catch (error) {
    res.status(500).json({ error: 'Failed to reject spot.' });
  }
};

// ============================================
// GET /api/spots/pending — Get pending spots (admin only)
// ============================================
const getPendingSpots = async (req, res) => {
  try {
    const spots = await Spot.findPendingApproval();
    res.json({ spots, total: spots.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending spots.' });
  }
};

module.exports = {
  createSpot,
  getSpots,
  getSpotById,
  updateSpot,
  toggleAvailability,
  approveSpot,
  rejectSpot,
  getPendingSpots
};