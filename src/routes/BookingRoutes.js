// src/routes/BookingRoutes.js
// ============================================
// BOOKING ROUTES
// ============================================
//
// Route table:
//   POST   /api/bookings              → Create booking (driver only)
//   GET    /api/bookings              → List bookings (role-based)
//   GET    /api/bookings/:id          → Booking details
//   PUT    /api/bookings/:id/checkin  → Check in (driver only)
//   PUT    /api/bookings/:id/checkout → Check out (driver only)
//   PUT    /api/bookings/:id/cancel   → Cancel booking

const router = require('express').Router();
const BookingController = require('../controllers/BookingController');
const authMiddleware = require('../middleware/AuthMiddleware');
const roleMiddleware = require('../middleware/RoleMiddleware');

// All booking routes require authentication
router.use(authMiddleware);

router.post('/', roleMiddleware('driver'), BookingController.createBooking);
router.get('/', BookingController.getBookings);
router.get('/:id', BookingController.getBookingById);
router.put('/:id/checkin', roleMiddleware('driver'), BookingController.checkIn);
router.put('/:id/checkout', roleMiddleware('driver'), BookingController.checkOut);
router.put('/:id/cancel', BookingController.cancelBooking);

module.exports = router;