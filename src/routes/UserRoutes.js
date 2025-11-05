import express from 'express';
import { authenticate } from '../middleware/AuthMiddleware.js';
import { authorize } from '../middleware/RoleMiddleware.js';
const router = express.Router();

router.get('/profile', authenticate, (req, res) => {
  res.json({ message: `Welcome user ${req.user.id}`, role: req.user.role });
});

router.get('/admin', authenticate, authorize('admin'), (req, res) => {
  res.json({ message: 'Admin access granted!' });
});

export default router;
