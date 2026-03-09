// src/controllers/BookingController.js
// ============================================
// BOOKING CONTROLLER
// ============================================
// Handles creating bookings, check-in, check-out, cancellation
//
// PRICE CALCULATION:
//   At booking creation:
//     expected_price = expected_duration × price_per_hour
//     total_price = expected_price (initially, before overtime)
//     admin_fee = total_price × 0.20
//     seller_amount = total_price × 0.80
//
//   At checkout (if overtime):
//     overtime_price = overtime_hours × price_per_hour
//     total_price = expected_price + overtime_price
//     admin_fee and seller_amount are recalculated

const Booking = require('../models/Booking');
const Spot = require('../models/Spot');

// ============================================
// POST /api/bookings — Create a booking (driver only)
// ============================================
const createBooking = async (req, res) => {
  try {
    const { spotId, startTime, endTime, vehicleNumber } = req.body;

    // Validate required fields
    if (!spotId || !startTime || !endTime) {
      return res.status(400).json({
        error: 'Required fields: spotId, startTime, endTime'
      });
    }

    // Get spot details
    const spot = await Spot.findById(spotId);
    if (!spot) {
      return res.status(404).json({ error: 'Spot not found.' });
    }

    // Check spot is available and approved
    if (!spot.is_approved) {
      return res.status(400).json({ error: 'This spot is not approved yet.' });
    }
    if (!spot.is_available) {
      return res.status(400).json({ error: 'This spot is not available.' });
    }
    if (spot.available_slots <= 0) {
      return res.status(400).json({ error: 'No available slots at this spot.' });
    }

    // Calculate duration
    const start = new Date(startTime);
    const end = new Date(endTime);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use ISO format.' });
    }
    if (end <= start) {
      return res.status(400).json({ error: 'End time must be after start time.' });
    }

    // Calculate expected duration in hours
    const durationMs = end - start;
    const expectedDurationHours = parseFloat(
      (durationMs / (1000 * 60 * 60)).toFixed(2)
    );

    // Calculate prices
    const pricePerHour = parseFloat(spot.price_per_hour);
    const expectedPriceXrp = parseFloat(
      (expectedDurationHours * pricePerHour).toFixed(6)
    );
    // Initially, total = expected (overtime added later at checkout)
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
      pricePerHour,
      expectedPriceXrp,
      totalPriceXrp,
      adminFeeXrp,
      sellerAmountXrp,
      vehicleNumber
    });

    // Decrease available slots
    await Spot.decrementSlot(spot.id);

    console.log(`📋 Booking created: ${req.user.name} → "${spot.title}" for ${expectedDurationHours}h`);

    res.status(201).json({
      message: 'Booking created. Proceed to payment.',
      booking,
      priceBreakdown: {
        pricePerHour,
        expectedDurationHours,
        expectedPriceXrp,
        adminFeeXrp,
        sellerAmountXrp,
        totalPriceXrp
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
    const { status } = req.query;  // Optional filter: ?status=active
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

    // Security: only allow access to own bookings (unless admin)
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
    // Verify driver owns this booking
    const existing = await Booking.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    if (existing.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'This is not your booking.' });
    }
    if (existing.booking_status !== 'confirmed') {
      return res.status(400).json({
        error: `Cannot check in. Booking status is: ${existing.booking_status}. Must be 'confirmed'.`
      });
    }

    const booking = await Booking.checkIn(req.params.id);

    if (!booking) {
      return res.status(400).json({ error: 'Check-in failed.' });
    }

    console.log(`🚗 Driver checked in: ${req.user.name}`);

    res.json({
      message: 'Checked in successfully. Parking timer started!',
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
    // Verify driver owns this booking
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

    // Free up the spot
    await Spot.incrementSlot(existing.spot_id);

    // Build response with overtime details
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

    // Free up the spot
    await Spot.incrementSlot(existing.spot_id);

    console.log(`🚫 Booking cancelled by ${req.user.name}`);

    res.json({ message: 'Booking cancelled.', booking });

  } catch (error) {
    console.error('Cancel booking error:', error.message);
    res.status(500).json({ error: 'Failed to cancel booking.' });
  }
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  checkIn,
  checkOut,
  cancelBooking
};