// src/routes/BookingCheckRoutes.js

const router = require('express').Router();
const { checkIn, checkOut } = require('../controllers/CheckingCheckoutController');
const authMiddleware = require('../middleware/AuthMiddleware');
const roleMiddleware = require('../middleware/RoleMiddleware');

router.use(authMiddleware);

router.put('/:id/checkin', roleMiddleware('driver'), checkIn);
router.put('/:id/checkout', roleMiddleware('driver'), checkOut);

module.exports = router;