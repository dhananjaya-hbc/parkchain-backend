// src/routes/BookingRoutes.js

const router = require('express').Router();
const BookingController = require('../controllers/BookingController');
const authMiddleware = require('../middleware/AuthMiddleware');
const roleMiddleware = require('../middleware/RoleMiddleware');

// All Booking routes require authentication
router.use(authMiddleware);

//availability check (any authenticated user — drivers, sellers, admin)
router.get('/availability/:spotId', BookingController.getSpotAvailability);

// CRUD routes
router.post('/', roleMiddleware('driver'), BookingController.createBooking);
router.get('/', BookingController.getBookings);
router.get('/:id', BookingController.getBookingById);
router.put('/:id/cancel', BookingController.cancelBooking);
router.get('/:id/fraud-check', BookingController.fraudCheck);

module.exports = router;