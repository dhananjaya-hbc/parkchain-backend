const db = require('../config/db');

const FcmToken = {
  /**
   * Register or refresh a token for a user.
   * Uses UPSERT — safe to call every time the app launches.
   */
  async upsert(userId, fcmToken, deviceType = null, deviceLabel = null) {
    const { rows } = await db.query(
      `INSERT INTO user_fcm_tokens (user_id, fcm_token, device_type, device_label, is_active, last_used_at)
       VALUES ($1, $2, $3, $4, TRUE, NOW())
       ON CONFLICT (fcm_token)
       DO UPDATE SET
         user_id      = EXCLUDED.user_id,
         device_type  = COALESCE(EXCLUDED.device_type, user_fcm_tokens.device_type),
         device_label = COALESCE(EXCLUDED.device_label, user_fcm_tokens.device_label),
         is_active    = TRUE,
         last_used_at = NOW()
       RETURNING *`,
      [userId, fcmToken, deviceType, deviceLabel]
    );
    return rows[0];
  },

  /**
   * Get all active tokens for a user.
   */

  async getActiveByUser(userId) {
    const { rows } = await db.query(
      `SELECT * FROM user_fcm_tokens
       WHERE user_id = $1 AND is_active = TRUE
       ORDER BY last_used_at DESC`,
      [userId]
    );
    return rows;
  },

  /**
   * Deactivate a specific token (called on logout or when FCM rejects it).
   */
  async deactivate(fcmToken) {
    const { rows } = await db.query(
      `UPDATE user_fcm_tokens
       SET is_active = FALSE
       WHERE fcm_token = $1
       RETURNING *`,
      [fcmToken]
    );
    return rows[0];
  },

  /**
   * Deactivate all tokens for a user (e.g. account banned / deleted).
   */
  async deactivateAllForUser(userId) {
    await db.query(
      `UPDATE user_fcm_tokens SET is_active = FALSE WHERE user_id = $1`,
      [userId]
    );
  },

  /**
   * Hard-delete a specific token (on explicit logout from one device).
   */
  async delete(userId, fcmToken) {
    const { rows } = await db.query(
      `DELETE FROM user_fcm_tokens
       WHERE user_id = $1 AND fcm_token = $2
       RETURNING *`,
      [userId, fcmToken]
    );
    return rows[0];
  },
};

module.exports = FcmToken;