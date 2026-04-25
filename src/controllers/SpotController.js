// src/controllers/SpotController.js
// ============================================
// SPOT CONTROLLER
// ============================================
// Handles HTTP requests for parking spots

const Spot = require('../models/Spot');
const KybSubmission = require('../models/KybSubmission');
const { query } = require('../config/db');

// ============================================
// POST /api/spots — Create a new spot (seller only)
// ============================================

// Normalize incoming multipart values to arrays
const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];

  if (typeof value === 'string') {
    const trimmed = value.trim();

    // Supports JSON string arrays: '["Car","Bike"]'
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fall through to single-item array
      }
    }

    return [value];
  }

  return [value];
};

// POST /api/spots — Create a new spot (seller only)
const createSpot = async (req, res) => {
  try {
    const {
      kybSubmissionId,
      title,
      description,
      address,
      latitude,
      longitude,
      vehicleTypes,
      slotsPerType,
      pricesPerHour,
      imageUrls,
    } = req.body;

    const uploadedImageUrls =
      Array.isArray(req.files) && req.files.length > 0
        ? req.files.map((file) => file.path)
        : toArray(imageUrls);

    let resolvedTitle = title;
    let resolvedAddress = address;

    if (kybSubmissionId) {
      const kyb = await KybSubmission.findById(kybSubmissionId);

      if (!kyb || kyb.owner_id !== req.user.id) {
        return res.status(404).json({ error: 'KYB submission not found.' });
      }

      if (kyb.status !== 'approved') {
        return res.status(403).json({ error: 'KYB must be approved before creating a spot.' });
      }

      const existingSpot = await Spot.findByKybSubmissionId(kybSubmissionId);

      if (existingSpot) {
        return res.status(409).json({ error: 'Spot already created for this KYB submission.' });
      }

      resolvedTitle = kyb.entity_name;
      resolvedAddress = kyb.address;
    }

    // Required fields
    if (!resolvedTitle || !resolvedAddress || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: 'Required fields: title, address, latitude, longitude',
      });
    }

    const parsedLatitude = parseFloat(latitude);
    const parsedLongitude = parseFloat(longitude);

    if (Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
      return res.status(400).json({
        error: 'latitude and longitude must be numbers',
      });
    }

    // Normalize arrays BEFORE validation
    const rawVehicleTypes = toArray(vehicleTypes).map((item) => String(item).trim());
    const rawSlotsPerType = toArray(slotsPerType).map((item) => Number(item));
    const rawPricesPerHour = toArray(pricesPerHour).map((item) => Number(item));

    if (
      rawVehicleTypes.length !== rawSlotsPerType.length ||
      rawVehicleTypes.length !== rawPricesPerHour.length
    ) {
      return res.status(400).json({
        error: 'vehicleTypes, slotsPerType, and pricesPerHour must have the same length',
      });
    }

    // Keep only complete rows; ignore default/unfilled rows (0/0)
    const completeRows = rawVehicleTypes
      .map((type, index) => ({
        type,
        slots: rawSlotsPerType[index],
        price: rawPricesPerHour[index],
      }))
      .filter(
        (row) =>
          row.type.length > 0 &&
          Number.isFinite(row.slots) &&
          Number.isFinite(row.price) &&
          row.slots > 0 &&
          row.price > 0
      );

    if (completeRows.length === 0) {
      return res.status(400).json({
        error: 'Must provide at least one complete row (vehicle type, slot count, hourly rate)',
      });
    }

    const cleanVehicleTypes = completeRows.map((row) => row.type);
    const cleanSlotsPerType = completeRows.map((row) => parseInt(row.slots, 10));
    const cleanPricesPerHour = completeRows.map((row) => parseFloat(row.price));
    const computedTotalSlots = cleanSlotsPerType.reduce((sum, slot) => sum + slot, 0);

    const spot = await Spot.create({
      ownerId: req.user.id,
      kybSubmissionId: kybSubmissionId || null,
      title: String(resolvedTitle).trim(),
      description: String(description || '').trim(),
      address: String(resolvedAddress).trim(),
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      vehicleTypes: cleanVehicleTypes,
      slotsPerType: cleanSlotsPerType,
      pricesPerHour: cleanPricesPerHour,
      imageUrls: uploadedImageUrls,
      totalSlots: computedTotalSlots,
    });

    const vehicleTypeCount = cleanVehicleTypes.length;
    const spotTitle = spot?.title || String(title).trim();
    console.log(`🅿️ New spot created: "${spotTitle}" with ${vehicleTypeCount} vehicle types`);

    return res.status(201).json({
      message: 'Spot created successfully and approved.',
      spot,
    });
  } catch (error) {
    console.error('Create spot error:', error.message);
    return res.status(500).json({ error: 'Failed to create spot.' });
  }
};

/*module.exports = {
  createSpot,
};*/

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
    const updates = { ...req.body };

    const uploadedImageUrls =
      Array.isArray(req.files) && req.files.length > 0
        ? req.files.map((file) => file.path)
        : null;

    if (uploadedImageUrls) {
      updates.imageUrls = uploadedImageUrls;
    } else if (updates.imageUrls !== undefined) {
      updates.imageUrls = toArray(updates.imageUrls)
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0);
    }
    
    // Lot counts and vehicle type structure are locked for now.
    // Ignore these fields even if sent by the client.
    delete updates.vehicleTypes;
    delete updates.slotsPerType;
    delete updates.totalSlots;

    if (updates.pricesPerHour !== undefined) {
      const currentSpot = await Spot.findById(req.params.id);

      if (!currentSpot || currentSpot.owner_id !== req.user.id) {
        return res.status(404).json({
          error: 'Spot not found or you do not own this spot.'
        });
      }

      const currentVehicleTypes = Array.isArray(currentSpot.vehicle_types)
        ? currentSpot.vehicle_types
        : [];

      const parsedPrices = toArray(updates.pricesPerHour).map((price) => Number(price));

      if (parsedPrices.length !== currentVehicleTypes.length) {
        return res.status(400).json({
          error: 'Hourly rates count must match the existing vehicle type count.'
        });
      }

      const hasInvalidPrice = parsedPrices.some((price) => !Number.isFinite(price) || price <= 0);

      if (hasInvalidPrice) {
        return res.status(400).json({
          error: 'Each hourly rate must be a number greater than 0.'
        });
      }

      updates.pricesPerHour = parsedPrices.map((price) => parseFloat(price));
    }

    const spot = await Spot.update(req.params.id, req.user.id, updates);

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
// PUT /api/spots/:id/admin-toggle — Toggle spot active status (admin only)
// ============================================
const adminToggleSpot = async (req, res) => {
  try {
    const spotId = req.params.id;
    const { is_active, is_available } = req.body;
    const nextAvailability =
      typeof is_active === 'boolean'
        ? is_active
        : is_available;

    if (typeof nextAvailability !== 'boolean') {
      return res.status(400).json({ error: 'is_active or is_available must be a boolean.' });
    }

    // Use existing schema column: spots.is_available
    const result = await query(
      'UPDATE spots SET is_available = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [nextAvailability, spotId]
    );

    const updatedSpot = result.rows[0];

    if (!updatedSpot) {
      return res.status(404).json({ error: 'Spot not found.' });
    }

    console.log(`🛡️ Admin ${nextAvailability ? 'Activated' : 'Blocked'} spot: "${updatedSpot.title}"`);

    res.json({ 
      message: `Spot is now ${updatedSpot.is_available ? 'Active' : 'Blocked'}.`, 
      spot: updatedSpot 
    });

  } catch (error) {
    console.error('Admin toggle spot error:', error.message);
    res.status(500).json({ error: 'Failed to toggle spot status.' });
  }
};


// ============================================
// DELETE /api/spots/:id — Delete spot (seller only)
// ============================================
const deleteSpot = async (req, res) => {
  try {
    const spotId = req.params.id;
    const ownerId = req.user.id;

    // 1. FIRST, get the KYB substitution ID attached to this spot
    // (Adjust the SQL based on your actual table/column names)
    const result = await query(
      'SELECT kyb_submission_id FROM spots WHERE id = $1 AND owner_id = $2', 
      [spotId, ownerId]
    );
    
    // Check if the spot exists before continuing
    const spotData = result.rows[0];
    if (!spotData) {
      return res.status(404).json({ error: 'Spot not found or you do not own this spot.' });
    }

    const kybSubmissionId = spotData.kyb_submission_id;

    // 2. THEN, delete the spot
    await Spot.delete(spotId, ownerId);

    // 3. FINALLY, safely delete the KYB submission record if it exists
    if (kybSubmissionId) {
      await query(
        'DELETE FROM kyb_submissions WHERE id = $1', 
        [kybSubmissionId]
      );
    }

    res.json({ message: 'Spot and associated KYB data deleted successfully.' });

  } catch (error) {
    console.error("Error deleting spot:", error);
    res.status(500).json({ error: 'Failed to delete spot.' });
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
  deleteSpot,
  adminToggleSpot,
  getPendingSpots
};