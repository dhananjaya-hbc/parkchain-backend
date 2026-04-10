// src/controllers/BookingController.js
// ============================================
// BOOKING CONTROLLER
// ============================================

const Booking = require('../models/Booking');
const Spot = require('../models/Spot');
const FraudDetectionService = require('../services/FraudDetectionService');
const { calculateDistance } = require('../utils/geoUtils');


// ============================================
// POST /api/bookings — Create a booking
// ============================================
const createBooking = async (req, res) => {
  try {
    const { spotId, startTime, endTime, vehicleType, vehicleNumber } = req.body;

    if (!spotId || !startTime || !endTime || !vehicleType) {
      return res.status(400).json({ error: 'Required fields: spotId, startTime, endTime, vehicleType' });
    }

    const spot = await Spot.findById(spotId);
    if (!spot) return res.status(404).json({ error: 'Spot not found.' });
    if (!spot.is_approved) return res.status(400).json({ error: 'This spot is not approved yet.' });

    const vehicleTypes = spot.vehicle_types || ['Car'];
    const pricesPerHour = spot.prices_per_hour || [10.0];
    const vehicleIndex = vehicleTypes.indexOf(vehicleType);
    
    if (vehicleIndex === -1) {
      return res.status(400).json({
        error: `Vehicle type "${vehicleType}" is not supported for this spot`,
        availableTypes: vehicleTypes,
        code: 'INVALID_VEHICLE_TYPE'
      });
    }
    
    const pricePerHour = parseFloat(pricesPerHour[vehicleIndex]);
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use ISO format.' });
    }
    if (end <= start) {
      return res.status(400).json({ error: 'End time must be after start time.' });
    }

    const overlappingCount = await Booking.countOverlapping(spotId, startTime, endTime);
    const totalSlots = spot.total_slots || 1;

    if (overlappingCount >= totalSlots) {
      return res.status(400).json({
        error: `No slots available for this time period. All ${totalSlots} slot(s) are booked.`,
        code: 'TIME_SLOT_FULL'
      });
    }

    const durationMs = end - start;
    const expectedDurationHours = parseFloat((durationMs / (1000 * 60 * 60)).toFixed(2));
    const expectedPriceXrp = parseFloat((expectedDurationHours * pricePerHour).toFixed(6));
    const totalPriceXrp = expectedPriceXrp;
    const adminFeeXrp = parseFloat((totalPriceXrp * 0.20).toFixed(6));
    const sellerAmountXrp = parseFloat((totalPriceXrp * 0.80).toFixed(6));

    const booking = await Booking.create({
      driverId: req.user.id, spotId: spot.id, ownerId: spot.owner_id,
      startTime, endTime, expectedDurationHours, vehicleType,        
      pricePerHour, expectedPriceXrp, totalPriceXrp,
      adminFeeXrp, sellerAmountXrp, vehicleNumber
    });

    res.status(201).json({
      message: 'Booking created. Proceed to payment.',
      booking,
      priceBreakdown: { vehicleType, pricePerHour, expectedDurationHours, expectedPriceXrp, adminFeeXrp, sellerAmountXrp, totalPriceXrp }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create booking.' });
  }
};

// ============================================
// GET /api/bookings — List Bookings
// ============================================
const getBookings = async (req, res) => {
  try {
    const { status } = req.query;
    let bookings;

    switch (req.user.role) {
      case 'driver': bookings = await Booking.findByDriver(req.user.id, status); break;
      case 'seller': bookings = await Booking.findByOwner(req.user.id, status); break;
      case 'admin': bookings = await Booking.findAll(); break;
      default: return res.status(403).json({ error: 'Invalid role.' });
    }

    res.json({ bookings, total: bookings.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bookings.' });
  }
};

// ============================================
// GET /api/bookings/:id — Get Booking Details
// ============================================
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    if (req.user.role !== 'admin' && booking.driver_id !== req.user.id && booking.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to this booking.' });
    }
    res.json({ booking });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booking.' });
  }
};

// ============================================
// PUT /api/bookings/:id/checkin — Check In (Geofenced)
// ============================================
const checkIn = async (req, res) => {
  try {
    const { driverLocation } = req.body;
    const CHECK_IN_RADIUS_TOLERANCE_METERS = 15; 

    if (!driverLocation || !driverLocation.lat || !driverLocation.lng) {
      return res.status(400).json({ error: 'Driver location (lat, lng) is required for check-in.' });
    }

    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Booking not found.' });
    if (existing.driver_id !== req.user.id) return res.status(403).json({ error: 'This is not your booking.' });
    
    if (existing.booking_status !== 'confirmed') {
      return res.status(400).json({ error: `Cannot check in. Booking status is: ${existing.booking_status}. Must be 'confirmed'.` });
    }

    const distance = calculateDistance(
        parseFloat(driverLocation.lat),
        parseFloat(driverLocation.lng),
        parseFloat(existing.spot_latitude),
        parseFloat(existing.spot_longitude)
    );

    if (distance > CHECK_IN_RADIUS_TOLERANCE_METERS) {
        return res.status(400).json({ 
            error: 'Too far from the spot. Please get closer to check-in.',
            currentDistance: Math.round(distance)
        });
    }

    const booking = await Booking.checkIn(req.params.id);
    if (!booking) return res.status(400).json({ error: 'Check-in failed.' });

    res.json({
      message: 'Checked in successfully. Parking timer started!',
      distance: Math.round(distance),
      booking
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check in.' });
  }
};

// ============================================
// PUT /api/bookings/:id/checkout — Check Out
// ============================================
const checkOut = async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Booking not found.' });
    if (existing.driver_id !== req.user.id) return res.status(403).json({ error: 'This is not your booking.' });
    
    if (existing.booking_status !== 'active') {
      return res.status(400).json({ error: `Cannot check out. Booking status is: ${existing.booking_status}. Must be 'active'.` });
    }

    const booking = await Booking.checkOut(req.params.id);
    if (!booking) return res.status(400).json({ error: 'Check-out failed.' });

    const hasOvertime = parseFloat(booking.overtime_hours) > 0;

    res.json({
      message: hasOvertime ? `Checked out. You stayed ${booking.overtime_hours} hours extra.` : 'Checked out on time!',
      booking,
      summary: {
        expectedDuration: parseFloat(booking.expected_duration_hours),
        actualDuration: parseFloat(booking.actual_duration_hours),
        overtimeHours: parseFloat(booking.overtime_hours),
        expectedPrice: parseFloat(booking.expected_price_xrp),
        overtimePrice: parseFloat(booking.overtime_price_xrp),
        totalPrice: parseFloat(booking.total_price_xrp),
        adminFee: parseFloat(booking.admin_fee_xrp),
        sellerAmount: parseFloat(booking.seller_amount_xrp)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check out.' });
  }
};

// ============================================
// PUT /api/bookings/:id/cancel — Cancel Booking
// ============================================
const cancelBooking = async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Booking not found.' });

    const booking = await Booking.cancel(req.params.id, req.user.id);
    if (!booking) return res.status(400).json({ error: 'Cannot cancel. Booking may already be active or completed.' });

    res.json({ message: 'Booking cancelled.', booking });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel booking.' });
  }
};

// ============================================
// POST /api/bookings/:id/fraud-check
// ============================================
const fraudCheck = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    if (booking.driver_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const result = await FraudDetectionService.analyzeBooking(
      booking.driver_id, booking.spot_id, booking.start_time, booking.end_time, booking.total_price_xrp
    );

    res.json({ bookingId: req.params.id, ...result });
  } catch (error) {
    res.status(500).json({ error: 'Fraud check failed.' });
  }
};

module.exports = {
  createBooking, getBookings, getBookingById, checkIn, checkOut, cancelBooking, fraudCheck
};