const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/AuthMiddleware');
const roleMiddleware = require('../middleware/RoleMiddleware');
const AdminKybController = require('../controllers/AdminKybController');

// 1. GET /api/admin/kyb
// Securely get ALL KYB submissions for the admin table, sorted oldest first
router.get('/', authMiddleware, roleMiddleware('admin'), AdminKybController.getAllSubmissions);


// 2. GET /api/admin/kyb/:id
// Get full details of a specific KYB request
router.get('/:id', authMiddleware, roleMiddleware('admin'), AdminKybController.getSubmissionDetails);


// 3. PUT /api/admin/kyb/:id/status
// Approve/Reject a KYB request
router.put('/:id/status', authMiddleware, roleMiddleware('admin'), AdminKybController.updateSubmissionStatus);

// We also permit PATCH for partial updates:
router.patch('/:id/status', authMiddleware, roleMiddleware('admin'), AdminKybController.updateSubmissionStatus);


module.exports = router;
