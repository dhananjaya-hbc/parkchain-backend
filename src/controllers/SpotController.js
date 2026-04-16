// src/controllers/SpotController.js
// ============================================
// SPOT CONTROLLER
// ============================================
// Handles HTTP requests for parking spots

const Spot = require('../models/Spot');

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
      title,
      description,
      address,
      latitude,
      longitude,
      vehicleTypes,
      slotsPerType,
      pricesPerHour,
      imageUrls,
      amenities,
    } = req.body;

    const uploadedImageUrls =
      Array.isArray(req.files) && req.files.length > 0
        ? req.files.map((file) => file.path)
        : toArray(imageUrls);

    // Required fields
    if (!title || !address || latitude === undefined || longitude === undefined) {
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

    // Amenities normalization
    const cleanAmenities = toArray(amenities)
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);

    const spot = await Spot.create({
      ownerId: req.user.id,
      title: String(title).trim(),
      description: String(description || '').trim(),
      address: String(address).trim(),
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      vehicleTypes: cleanVehicleTypes,
      slotsPerType: cleanSlotsPerType,
      pricesPerHour: cleanPricesPerHour,
      imageUrls: uploadedImageUrls,
      totalSlots: computedTotalSlots,
      amenities: cleanAmenities,
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
    const updates = req.body;
    
    // ⭐ Validate row-based slot data if provided
    if (updates.vehicleTypes || updates.slotsPerType || updates.pricesPerHour) {
      if (!Array.isArray(updates.vehicleTypes) || !Array.isArray(updates.slotsPerType) || !Array.isArray(updates.pricesPerHour)) {
        return res.status(400).json({
          error: 'vehicleTypes, slotsPerType, and pricesPerHour must be arrays'
        });
      }

      if (updates.vehicleTypes.length !== updates.slotsPerType.length || updates.vehicleTypes.length !== updates.pricesPerHour.length) {
        return res.status(400).json({
          error: 'vehicleTypes, slotsPerType, and pricesPerHour must have the same length'
        });
      }

      const hasIncompleteRow = updates.vehicleTypes.some((type, index) => {
        const slots = updates.slotsPerType[index];
        const price = updates.pricesPerHour[index];

        return (
          typeof type !== 'string' || type.trim().length === 0 ||
          slots === undefined || slots === null || isNaN(slots) || Number(slots) <= 0 ||
          price === undefined || price === null || isNaN(price) || Number(price) <= 0
        );
      });

      if (hasIncompleteRow) {
        return res.status(400).json({
          error: 'Each row must have a vehicle type, slot count, and hourly rate'
        });
      }

      updates.vehicleTypes = updates.vehicleTypes.map((type) => type.trim());
      updates.slotsPerType = updates.slotsPerType.map((slot) => parseInt(slot, 10));
      updates.pricesPerHour = updates.pricesPerHour.map((price) => parseFloat(price));
      updates.totalSlots = updates.slotsPerType.reduce((sum, slot) => sum + slot, 0);
    }

    if (updates.amenities !== undefined) {
      if (!Array.isArray(updates.amenities)) {
        return res.status(400).json({
          error: 'amenities must be an array'
        });
      }

      const hasInvalidAmenity = updates.amenities.some(
        (item) => typeof item !== 'string' || item.trim().length === 0
      );

      if (hasInvalidAmenity) {
        return res.status(400).json({
          error: 'Each amenity must be a non-empty string'
        });
      }

      updates.amenities = updates.amenities.map((item) => item.trim());
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