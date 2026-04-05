// src/controllers/BookingController.js
// ============================================
// BOOKING CONTROLLER
// ============================================
// Now uses TIME-SLOT OVERLAP checking instead of simple slot counting
//
// OLD: Check available_slots > 0 (blocks ALL times when full)
// NEW: Check overlapping bookings < total_slots (only blocks SAME time)

const Booking = require('../models/Booking');
const Spot = require('../models/Spot');
const FraudDetectionService = require('../services/FraudDetectionService');
const { calculateDistance } = require('../utils/geoUtils');


// ============================================
// POST /api/bookings — Create a booking (driver only)
// ============================================
const createBooking = async (req, res) => {
  try {
    const { spotId, startTime, endTime, vehicleType, vehicleNumber } = req.body;  // ⭐ vehicleType required

    // Validate required fields
    if (!spotId || !startTime || !endTime || !vehicleType) {  // ⭐ vehicleType is required
      return res.status(400).json({
        error: 'Required fields: spotId, startTime, endTime, vehicleType'
      });
    }

    // Get spot details
    const spot = await Spot.findById(spotId);
    if (!spot) {
      return res.status(404).json({ error: 'Spot not found.' });
    }

    if (!spot.is_approved) {
      return res.status(400).json({ error: 'This spot is not approved yet.' });
    }

    // ⭐ NEW: Validate vehicle type and get price
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

    console.log(`🚗 Vehicle type: ${vehicleType}, Price: ${pricePerHour} XRP/h`);

    // Calculate duration
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use ISO format.' });
    }
    if (end <= start) {
      return res.status(400).json({ error: 'End time must be after start time.' });
    }

    // Check time-slot availability
    const overlappingCount = await Booking.countOverlapping(spotId, startTime, endTime);
    const totalSlots = spot.total_slots || 1;

    if (overlappingCount >= totalSlots) {
      return res.status(400).json({
        error: `No slots available for this time period. All ${totalSlots} slot(s) are booked.`,
        code: 'TIME_SLOT_FULL',
        details: {
          requestedStart: startTime,
          requestedEnd: endTime,
          totalSlots: totalSlots,
          bookedSlots: overlappingCount
        }
      });
    }

    console.log(`📊 Slot check: ${overlappingCount}/${totalSlots} booked for requested time`);

    // Calculate expected duration in hours
    const durationMs = end - start;
    const expectedDurationHours = parseFloat(
      (durationMs / (1000 * 60 * 60)).toFixed(2)
    );

    // ⭐ Calculate prices using vehicle-specific rate
    const expectedPriceXrp = parseFloat(
      (expectedDurationHours * pricePerHour).toFixed(6)
    );
    const totalPriceXrp = expectedPriceXrp;
    const adminFeeXrp = parseFloat((totalPriceXrp * 0.20).toFixed(6));
    const sellerAmountXrp = parseFloat((totalPriceXrp * 0.80).toFixed(6));

    // Create the booking
    const booking = await Booking.create({
      driverId: req.user.id,
      spotId: spot.id,
      ownerId: spot.owner_id,
      startTime,
      endTime,
      expectedDurationHours,
      vehicleType,        // ⭐ NEW
      pricePerHour,       // ⭐ Vehicle-specific price
      expectedPriceXrp,
      totalPriceXrp,
      adminFeeXrp,
      sellerAmountXrp,
      vehicleNumber
    });

    console.log(`📋 Booking created: ${req.user.name} → "${spot.title}"`);
    console.log(`   Vehicle: ${vehicleType} @ ${pricePerHour} XRP/h`);
    console.log(`   Duration: ${expectedDurationHours}h = ${expectedPriceXrp} XRP`);
    console.log(`   Slots used: ${overlappingCount + 1}/${totalSlots}`);

    res.status(201).json({
      message: 'Booking created. Proceed to payment.',
      booking,
      priceBreakdown: {
        vehicleType,              // ⭐ NEW
        pricePerHour,
        expectedDurationHours,
        expectedPriceXrp,
        adminFeeXrp,
        sellerAmountXrp,
        totalPriceXrp
      },
      slotInfo: {
        totalSlots,
        bookedForThisTime: overlappingCount + 1,
        remainingForThisTime: totalSlots - overlappingCount - 1
      }
    });
  } catch (error) {
    console.error('Create booking error:', error.message);
    res.status(500).json({ error: 'Failed to create booking.' });
  }
};

// ============================================
// GET /api/bookings — Get bookings (role-based)
// ============================================
const getBookings = async (req, res) => {
  try {
    const { status } = req.query;
    let bookings;

    switch (req.user.role) {
      case 'driver':
        bookings = await Booking.findByDriver(req.user.id, status);
        break;
      case 'seller':
        bookings = await Booking.findByOwner(req.user.id, status);
        break;
      case 'admin':
        bookings = await Booking.findAll();
        break;
      default:
        return res.status(403).json({ error: 'Invalid role.' });
    }

    res.json({ bookings, total: bookings.length });
  } catch (error) {
    console.error('Get bookings error:', error.message);
    res.status(500).json({ error: 'Failed to fetch bookings.' });
  }
};

// ============================================
// GET /api/bookings/:id — Get booking by ID
// ============================================
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (req.user.role !== 'admin' &&
        booking.driver_id !== req.user.id &&
        booking.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to this booking.' });
    }

    res.json({ booking });
  } catch (error) {
    console.error('Get booking error:', error.message);
    res.status(500).json({ error: 'Failed to fetch booking.' });
  }
};

// ============================================
// PUT /api/bookings/:id/checkin — Driver checks in
// ============================================
const checkIn = async (req, res) => {
  try {
    const { driverLocation } = req.body;
    const CHECK_IN_RADIUS_TOLERANCE_METERS = 15; // 10m limit + 5m GPS drift tolerance

    // 1. Verify frontend provided location
    if (!driverLocation || !driverLocation.lat || !driverLocation.lng) {
      return res.status(400).json({ error: 'Driver location (lat, lng) is required for check-in.' });
    }

    // 2. Fetch the existing booking using your Model
    const existing = await Booking.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    
    // 3. Authorization and State checks
    if (existing.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'This is not your booking.' });
    }
    if (existing.booking_status !== 'confirmed') {
      return res.status(400).json({
        error: `Cannot check in. Booking status is: ${existing.booking_status}. Must be 'confirmed'.`
      });
    }

    // 4. Server-Side Distance Verification
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

    // 5. Database Update (Your model already sets actual_start_time and 'active' status!)
    const booking = await Booking.checkIn(req.params.id);

    if (!booking) {
      return res.status(400).json({ error: 'Check-in failed.' });
    }

    console.log(`🚗 Driver checked in: ${req.user.name} | Distance: ${distance.toFixed(2)}m`);

    res.json({
      message: 'Checked in successfully. Parking timer started!',
      distance: Math.round(distance),
      booking
    });
  } catch (error) {
    console.error('Check-in error:', error.message);
    res.status(500).json({ error: 'Failed to check in.' });
  }
};

// ============================================
// PUT /api/bookings/:id/checkout — Driver checks out
// ============================================
const checkOut = async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    if (existing.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'This is not your booking.' });
    }
    if (existing.booking_status !== 'active') {
      return res.status(400).json({
        error: `Cannot check out. Booking status is: ${existing.booking_status}. Must be 'active'.`
      });
    }

    const booking = await Booking.checkOut(req.params.id);

    if (!booking) {
      return res.status(400).json({ error: 'Check-out failed.' });
    }

    // ★ REMOVED: No more Spot.incrementSlot()
    // Time-based overlap handles this automatically

    const hasOvertime = parseFloat(booking.overtime_hours) > 0;

    console.log(`🏁 Driver checked out: ${req.user.name} | Overtime: ${hasOvertime ? booking.overtime_hours + 'h' : 'None'}`);

    res.json({
      message: hasOvertime
        ? `Checked out. You stayed ${booking.overtime_hours} hours extra.`
        : 'Checked out on time!',
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
    console.error('Check-out error:', error.message);
    res.status(500).json({ error: 'Failed to check out.' });
  }
};

// ============================================
// PUT /api/bookings/:id/cancel — Cancel booking
// ============================================
const cancelBooking = async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const booking = await Booking.cancel(req.params.id, req.user.id);

    if (!booking) {
      return res.status(400).json({
        error: 'Cannot cancel. Booking may already be active or completed.'
      });
    }

    // ★ REMOVED: No more Spot.incrementSlot()
    // Cancelled bookings are excluded from overlap count automatically

    console.log(`🚫 Booking cancelled by ${req.user.name}`);

    res.json({ message: 'Booking cancelled.', booking });
  } catch (error) {
    console.error('Cancel booking error:', error.message);
    res.status(500).json({ error: 'Failed to cancel booking.' });
  }
};

// ============================================
// POST /api/bookings/:id/fraud-check — AI Fraud Detection
// ============================================
const fraudCheck = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (booking.driver_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const result = await FraudDetectionService.analyzeBooking(
      booking.driver_id,
      booking.spot_id,
      booking.start_time,
      booking.end_time,
      booking.total_price_xrp
    );

    res.json({
      bookingId: req.params.id,
      ...result
    });
  } catch (error) {
    console.error('Fraud check error:', error.message);
    res.status(500).json({ error: 'Fraud check failed.' });
  }
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  checkIn,
  checkOut,
  cancelBooking,
  fraudCheck,
        
};