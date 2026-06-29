const FcmToken = require('../models/FcmToken');
const { fireEvent , EVENTS } = require('../events/NotificationEvents');
// import FcmToken from '../models/FcmToken.js';

const FcmTokenController = {
  /**
   * POST /api/notifications/token
   * Register or refresh FCM token for the authenticated user.
   *
   * Body: { fcm_token, device_type?, device_label? }
   */
  async register(req, res) {
    console.log('[FcmTokenController] Registering token for user:', req.user.id);
    try {
      const { fcm_token, device_type, device_label } = req.body;

      if (!fcm_token) {
        return res.status(400).json({ message: 'fcm_token is required' });
      }

      const validDeviceTypes = ['android', 'ios', 'web'];
      if (device_type && !validDeviceTypes.includes(device_type)) {
        return res.status(400).json({
          message: `device_type must be one of: ${validDeviceTypes.join(', ')}`,
        });
      }

      const token = await FcmToken.upsert(
        req.user.id,
        fcm_token,
        device_type || null,
        device_label || null
      );

      return res.status(200).json({ message: 'Token registered', token });
    } catch (err) {
      console.error('[FcmTokenController] register error:', err.message);
      return res.status(500).json({ message: 'Failed to register token' });
    }
  },

  /**
   * DELETE /api/notifications/token
   * Remove a specific FCM token (logout from this device).
   *
   * Body: { fcm_token }
   */
  async remove(req, res) {
    try {
      const { fcm_token } = req.body;

      if (!fcm_token) {
        return res.status(400).json({ message: 'fcm_token is required' });
      }

      const deleted = await FcmToken.delete(req.user.id, fcm_token);

      if (!deleted) {
        return res.status(404).json({ message: 'Token not found' });
      }

      return res.status(200).json({ message: 'Token removed' });
    } catch (err) {
      console.error('[FcmTokenController] remove error:', err.message);
      return res.status(500).json({ message: 'Failed to remove token' });
    }
  },

  /**
   * GET /api/notifications/tokens
   * List all active tokens for the authenticated user.
   */
  async list(req, res) {
    try {
      const tokens = await FcmToken.getActiveByUser(req.user.id);
      return res.status(200).json({ tokens });
    } catch (err) {
      console.error('[FcmTokenController] list error:', err.message);
      return res.status(500).json({ message: 'Failed to fetch tokens' });
    }
  },
};

module.exports = FcmTokenController;