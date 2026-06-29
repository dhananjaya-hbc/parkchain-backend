const db = require("../config/db");

const NotificationController = {
  /**
   * GET /api/notifications
   * Retrieve all notifications for the authenticated user.
   * Supports pagination and filtering by read status.
   *
   * Query params:
   *   - limit: number of notifications (default: 20, max: 100)
   *   - offset: pagination offset (default: 0)
   *   - read: filter by read status ('true', 'false', or omit for all)
   */
  async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = parseInt(req.query.offset) || 0;
      const readFilter = req.query.read;

      console.log(`[NotificationController] Fetching notifications for user ${userId}`);

      let query = `
        SELECT id, title, body, data, is_read, sent_at, read_at
        FROM user_notifications
        WHERE user_id = $1
      `;
      const params = [userId];

      // Apply read filter if provided
      if (readFilter !== undefined) {
        const isRead = readFilter === "true";
        query += ` AND is_read = $${params.length + 1}`;
        params.push(isRead);
      }

      // Order by most recent first and apply pagination
      query += ` ORDER BY sent_at DESC LIMIT $${params.length + 1} OFFSET $${
        params.length + 2
      }`;
      params.push(limit, offset);

      const { rows } = await db.query(query, params);

      // Get total count for pagination
      let countQuery = `SELECT COUNT(*) FROM user_notifications WHERE user_id = $1`;
      const countParams = [userId];

      if (readFilter !== undefined) {
        const isRead = readFilter === "true";
        countQuery += ` AND is_read = $2`;
        countParams.push(isRead);
      }

      const { rows: countResult } = await db.query(countQuery, countParams);
      const total = parseInt(countResult[0].count);

      console.log("Notifications rows ",rows[0]);

      return res.status(200).json({
        message: "Notifications retrieved successfully",
        data: rows,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      });
    } catch (err) {
      console.error("[NotificationController] getNotifications error:", err.message);
      return res.status(500).json({ message: "Failed to fetch notifications" });
    }
  },

  /**
   * GET /api/notifications/unread
   * Retrieve count of unread notifications for the authenticated user.
   */
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;

      const { rows } = await db.query(
        `SELECT COUNT(*) as unread_count FROM user_notifications
         WHERE user_id = $1 AND is_read = FALSE`,
        [userId]
      );

      const unreadCount = parseInt(rows[0].unread_count);

      return res.status(200).json({
        message: "Unread count retrieved successfully",
        unreadCount,
      });
    } catch (err) {
      console.error("[NotificationController] getUnreadCount error:", err.message);
      return res.status(500).json({ message: "Failed to fetch unread count" });
    }
  },

  /**
   * PUT /api/notifications/:id/read
   * Mark a specific notification as read.
   */
  async markAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Verify the notification belongs to this user
      const { rows: notifRows } = await db.query(
        `SELECT id FROM user_notifications
         WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (!notifRows.length) {
        return res.status(404).json({ message: "Notification not found" });
      }

      // Mark as read
      await db.query(
        `UPDATE user_notifications
         SET is_read = TRUE, read_at = NOW()
         WHERE id = $1`,
        [id]
      );

      return res.status(200).json({ message: "Notification marked as read" });
    } catch (err) {
      console.error("[NotificationController] markAsRead error:", err.message);
      return res.status(500).json({ message: "Failed to mark notification as read" });
    }
  },

  /**
   * PUT /api/notifications/read-all
   * Mark all notifications as read for the authenticated user.
   */
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;

      const result = await db.query(
        `UPDATE user_notifications
         SET is_read = TRUE, read_at = NOW()
         WHERE user_id = $1 AND is_read = FALSE`,
        [userId]
      );

      return res.status(200).json({
        message: "All notifications marked as read",
        updated: result.rowCount,
      });
    } catch (err) {
      console.error("[NotificationController] markAllAsRead error:", err.message);
      return res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  },

  /**
   * DELETE /api/notifications/:id
   * Delete a specific notification.
   */
  async deleteNotification(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Verify the notification belongs to this user and delete
      const result = await db.query(
        `DELETE FROM user_notifications
         WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Notification not found" });
      }

      return res.status(200).json({ message: "Notification deleted successfully" });
    } catch (err) {
      console.error("[NotificationController] deleteNotification error:", err.message);
      return res.status(500).json({ message: "Failed to delete notification" });
    }
  },

  /**
   * DELETE /api/notifications
   * Delete all notifications for the authenticated user.
   */
  async deleteAllNotifications(req, res) {
    try {
      const userId = req.user.id;

      const result = await db.query(
        `DELETE FROM user_notifications WHERE user_id = $1`,
        [userId]
      );

      return res.status(200).json({
        message: "All notifications deleted successfully",
        deleted: result.rowCount,
      });
    } catch (err) {
      console.error("[NotificationController] deleteAllNotifications error:", err.message);
      return res.status(500).json({ message: "Failed to delete notifications" });
    }
  },
};

module.exports = NotificationController;
