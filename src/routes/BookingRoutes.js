// src/routes/BookingRoutes.js

const router = require('express').Router();
const BookingController = require('../controllers/BookingController');
const authMiddleware    = require('../middleware/AuthMiddleware');
const roleMiddleware    = require('../middleware/RoleMiddleware');

router.use(authMiddleware);

// ✅ SPECIFIC routes FIRST (before /:id)
router.get('/availability/:spotId', BookingController.getSpotAvailability);

// ✅ General routes after
router.post('/',    roleMiddleware('driver'), BookingController.createBooking);
router.get('/',                              BookingController.getBookings);

// ✅ Param routes LAST
router.get('/:id',                           BookingController.getBookingById);
router.put('/:id/checkin',  roleMiddleware('driver'), BookingController.checkIn);
router.put('/:id/checkout', roleMiddleware('driver'), BookingController.checkOut);
router.put('/:id/cancel',                            BookingController.cancelBooking);
router.get('/:id/fraud-check',                       BookingController.fraudCheck);

module.exports = router;