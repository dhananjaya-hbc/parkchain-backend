// src/controllers/BookingController.js
// ============================================
// BOOKING CONTROLLER
// ============================================
const { EVENTS, fireEvent } = require('../events/NotificationEvents');
const Booking = require('../models/Booking');
const Spot = require('../models/Spot');
const FraudDetectionService = require('../services/FraudDetectionService');

// ============================================
// POST /api/bookings — Create a booking
// ============================================
const createBooking = async (req, res) => {
  try {
    const { spotId, startTime, endTime, vehicleType, vehicleNumber } = req.body;

    // ── Validate required fields ──────────────────────────
    if (!spotId || !startTime || !endTime || !vehicleType) {
      return res.status(400).json({
        error: 'Required fields: spotId, startTime, endTime, vehicleType'
      });
    }

    // ── Load spot ─────────────────────────────────────────
    const spot = await Spot.findById(spotId);
    if (!spot) {
      return res.status(404).json({ error: 'Spot not found.' });
    }
    if (!spot.is_approved) {
      return res.status(400).json({ error: 'This spot is not approved yet.' });
    }
    if (!spot.is_available) {
      return res.status(400).json({ error: 'This spot is currently unavailable.' });
    }

    // ── Validate vehicle type ─────────────────────────────
    const vehicleTypes = spot.vehicle_types || ['Car'];
    const pricesPerHour = spot.prices_per_hour || [10.0];
    const slotsPerType = spot.slots_per_type || [1];

    const vehicleIndex = vehicleTypes.indexOf(vehicleType);
    if (vehicleIndex === -1) {
      return res.status(400).json({
        error: `Vehicle type "${vehicleType}" is not supported for this spot.`,
        availableTypes: vehicleTypes,
        code: 'INVALID_VEHICLE_TYPE'
      });
    }

    // ── Get this vehicle type's slot count & price ────────
    const slotsForThisType = parseInt(slotsPerType[vehicleIndex]) || 1;
    const pricePerHour = parseFloat(pricesPerHour[vehicleIndex]);

    // ── Validate times ────────────────────────────────────
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use ISO format (e.g. 2025-01-15T18:00:00Z).'
      });
    }
    if (end <= start) {
      return res.status(400).json({
        error: 'End time must be after start time.'
      });
    }

    // ── Must be a future booking ──────────────────────────
    const now = new Date();
    if (start < now) {
      return res.status(400).json({
        error: 'Start time must be in the future.',
        code: 'PAST_TIME'
      });
    }

    // ── Check slot availability PER VEHICLE TYPE ──────────
    //e.g - Car has 10 slots, Bike has 5 slots — checked separately
    const overlappingCount = await Booking.countOverlappingByVehicleType(
      spotId,
      vehicleType,
      startTime,
      endTime
    );

    if (overlappingCount >= slotsForThisType) {
      return res.status(400).json({
        error: `No ${vehicleType} slots available for this time period. All ${slotsForThisType} slot(s) are booked.`,
        code: 'TIME_SLOT_FULL',
        details: {
          vehicleType,
          totalSlots: slotsForThisType,
          bookedSlots: overlappingCount,
          availableSlots: 0,
          requestedTime: { startTime, endTime }
        }
      });
    }

    // ── Calculate price ───────────────────────────────────
    const durationMs = end - start;
    const expectedDurationHours = parseFloat((durationMs / (1000 * 60 * 60)).toFixed(2));
    const expectedPriceXrp = parseFloat((expectedDurationHours * pricePerHour).toFixed(6));
    const totalPriceXrp = expectedPriceXrp;
    const adminFeeXrp = parseFloat((totalPriceXrp * 0.20).toFixed(6));
    const sellerAmountXrp = parseFloat((totalPriceXrp * 0.80).toFixed(6));

    // ── Create booking ────────────────────────────────────
    const booking = await Booking.create({
      driverId: req.user.id,
      spotId: spot.id,
      ownerId: spot.owner_id,
      startTime,
      endTime,
      expectedDurationHours,
      vehicleType,
      pricePerHour,
      expectedPriceXrp,
      totalPriceXrp,
      adminFeeXrp,
      sellerAmountXrp,
      vehicleNumber
    });
    // console.log('Booking created:', booking);
    //   await fireEvent(EVENTS.BOOKING_CONFIRMED_DRIVER, booking.driver_id, {
    //   spotName: spot.title,
    //   date:booking.start_time.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    // });
    res.status(201).json({
      message: 'Booking created. Proceed to payment.',
      booking,
      priceBreakdown: {
        vehicleType,
        pricePerHour,
        expectedDurationHours,
        expectedPriceXrp,
        adminFeeXrp,
        sellerAmountXrp,
        totalPriceXrp
      },
      slotInfo: {
        vehicleType,
        totalSlots: slotsForThisType,
        bookedSlots: overlappingCount,
        remainingSlots: slotsForThisType - overlappingCount
      }
    });
    // Send notifications to owner and driver about new booking
    // to owner
    // await fireEvent(EVENTS.BOOKING_CONFIRMED_OWNER, booking.ownerId, {
    //   spotName: spot.title,
    //   date:booking.start_time.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    // });
    //to driver
    // await fireEvent(EVENTS.BOOKING_CONFIRMED_DRIVER, booking.driverId, {
    //   spotName: spot.title,
    //   date:booking.start_time.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    // });

  } catch (error) {
    console.error('createBooking error:', error);
    res.status(500).json({ error: 'Failed to create booking.' });
  }
};

// ============================================
// GET /api/bookings/availability/:spotId
// ============================================
const getSpotAvailability = async (req, res) => {
  try {
    const { spotId } = req.params;
    const { startTime, endTime } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        error: 'Query params required: startTime, endTime'
      });
    }

    const spot = await Spot.findById(spotId);
    if (!spot) {
      return res.status(404).json({ error: 'Spot not found.' });
    }

    const vehicleTypes = spot.vehicle_types || ['Car'];
    const slotsPerType = spot.slots_per_type || [1];
    const pricesPerHour = spot.prices_per_hour || [10.0];


    const bookedCounts = await Booking.getAvailabilityByTimeRange(
      spotId, startTime, endTime
    );

    const bookedMap = {};
    bookedCounts.forEach(row => {
      bookedMap[row.vehicle_type] = parseInt(row.booked_count);
    });

    const availability = vehicleTypes.map((type, index) => {
      const totalSlots = parseInt(slotsPerType[index]) || 1;
      const bookedSlots = bookedMap[type] || 0;
      const availableSlots = Math.max(0, totalSlots - bookedSlots);

      return {
        vehicleType: type,
        pricePerHour: parseFloat(pricesPerHour[index]),
        totalSlots,
        bookedSlots,
        availableSlots,
        isAvailable: availableSlots > 0
      };
    });

    res.json({
      spotId,
      spotTitle: spot.title,
      requestedTime: { startTime, endTime },
      availability
    });

  } catch (error) {
    console.error('getSpotAvailability error:', error);
    res.status(500).json({ error: 'Failed to get availability.' });
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
      case 'driver':
        bookings = await Booking.findByDriver(req.user.id, status);
        break;
      case 'seller':
        bookings = await Booking.findByOwner(req.user.id, status);
        break;
      case 'admin': {
        const rawBookings = await Booking.findAll();
        bookings = rawBookings.map((b) => {
          try {
            const fraud = FraudDetectionService.calculateRiskFromPrecomputed(b);
            return {
              ...b,
              fraud_score: fraud.riskScore,
              fraud_level: fraud.riskLevel
            };
          } catch (e) {
            console.error(`Error calculating fraud for booking ${b.id}:`, e);
            return {
              ...b,
              fraud_score: 0,
              fraud_level: 'low'
            };
          }
        });
        break;
      }
      default:
        return res.status(403).json({ error: 'Invalid role.' });
    }

    res.json({ bookings, total: bookings.length });
  } catch (error) {
    console.error('getBookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings.' });
  }
};

// ============================================
// GET /api/bookings/:id — Get Booking Details
// ============================================
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (
      req.user.role !== 'admin' &&
      booking.driver_id !== req.user.id &&
      booking.owner_id !== req.user.id
    ) {
      return res.status(403).json({ error: 'Access denied to this booking.' });
    }

    res.json({ booking });
  } catch (error) {
    console.error('getBookingById error:', error);
    res.status(500).json({ error: 'Failed to fetch booking.' });
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
    if (!booking) {
      return res.status(400).json({
        error: 'Cannot cancel. Booking may already be active or completed.'
      });
    }

    res.json({ message: 'Booking cancelled.', booking });
  } catch (error) {
    console.error('cancelBooking error:', error);
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
      booking.driver_id,
      booking.spot_id,
      booking.start_time,
      booking.end_time,
      booking.total_price_xrp
    );

    res.json({ bookingId: req.params.id, ...result });
  } catch (error) {
    console.error('fraudCheck error:', error);
    res.status(500).json({ error: 'Fraud check failed.' });
  }
};


module.exports = {
  createBooking,
  getSpotAvailability,
  getBookings,
  getBookingById,
  cancelBooking,
  fraudCheck
};