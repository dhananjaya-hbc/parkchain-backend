const db = require("../config/db");
// import db from '../config/db.js';
const { sendMulticast } = require("../services/FirebaseService");
// import { sendMulticast } from '../services/FirebaseService.js';

// ─── Event name constants ────────────────────────────────────────────────────

const EVENTS = {
  // Booking
  BOOKING_CONFIRMED_DRIVER: "BOOKING_CONFIRMED_DRIVER",
  BOOKING_CONFIRMED_OWNER: "BOOKING_CONFIRMED_OWNER",
  
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  BOOKING_STARTED: "BOOKING_STARTED",
  BOOKING_ENDED: "BOOKING_ENDED",
  NEW_BOOKING_REQUEST: "NEW_BOOKING_REQUEST", // sent to seller

  // Payments
  PAYMENT_SUCCESS: "PAYMENT_SUCCESS",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  REFUND_ISSUED: "REFUND_ISSUED",

  // KYC
  KYC_APPROVED: "KYC_APPROVED",
  KYC_REJECTED: "KYC_REJECTED",

  // KYB
  NEW_KYB_REQUEST: "NEW_KYB_REQUEST", // sent to admins when a new KYB is submitted
  KYB_APPROVED: "KYB_APPROVED",
  KYB_REJECTED: "KYB_REJECTED",

  // Spots
  SPOT_APPROVED: "SPOT_APPROVED",
  SPOT_REJECTED: "SPOT_REJECTED",
  SPOT_AVAILABLE: "SPOT_AVAILABLE",
  SPOT_UNAVAILABLE: "SPOT_UNAVAILABLE",
};

// ─── Message templates ───────────────────────────────────────────────────────

const templates = {
  [EVENTS.NEW_KYB_REQUEST]: (d) => ({
    title: "New KYB Submission 🏢",
    body: `${d.businessName} has submitted a KYB application. Review needed.`,
  }),

  //----booking-----//
  [EVENTS.BOOKING_CONFIRMED_DRIVER]: (d) => ({
    title: "Booking Confirmed",
    body: `Your booking for ${d.spotName} on ${d.date} is confirmed.`,
  }),
  [EVENTS.BOOKING_CONFIRMED_OWNER]: (d) => ({
    title: "New Booking Received",
    body: `Your spot "${d.spotName}" have a new booking on ${d.date}.`,
  }),
  //----Spots----//
  [EVENTS.SPOT_APPROVED]: (d) => ({
    title: "Spot Approved ✅",
    body: `Your spot "${d.spotName}" has been approved and is now live.`,
  }),
  [EVENTS.SPOT_REJECTED]: (d) => ({
    title: "Spot Rejected",
    body: `Your spot "${d.spotName}" has been rejected.`,
  }),
  [EVENTS.BOOKING_CANCELLED]: (d) => ({
    title: "Booking Cancelled",
    body: `Your booking for ${d.spotName} has been cancelled.`,
  }),
  [EVENTS.BOOKING_STARTED]: (d) => ({
    title: "Parking Started 🅿️",
    body: `Your parking session at ${d.spotName} has started.`,
  }),
  [EVENTS.BOOKING_ENDED]: (d) => ({
    title: "Parking Ended",
    body: `Your parking session at ${d.spotName} has ended. Total: ${d.amount}.`,
  }),
  [EVENTS.NEW_BOOKING_REQUEST]: (d) => ({
    title: "New Booking Request 📥",
    body: `${d.userName} has requested to book ${d.spotName} on ${d.date}.`,
  }),

  [EVENTS.PAYMENT_SUCCESS]: (d) => ({
    title: "Payment Successful 💳",
    body: `Payment of ${d.amount} received for booking #${d.bookingId}.`,
  }),
  [EVENTS.PAYMENT_FAILED]: (d) => ({
    title: "Payment Failed ❌",
    body: `Your payment of ${d.amount} could not be processed. Please retry.`,
  }),
  [EVENTS.REFUND_ISSUED]: (d) => ({
    title: "Refund Issued 💰",
    body: `A refund of ${d.amount} has been issued for booking #${d.bookingId}.`,
  }),

  [EVENTS.KYC_APPROVED]: () => ({
    title: "Identity Verified ✅",
    body: "Your identity verification has been approved. You can now make bookings.",
  }),
  [EVENTS.KYC_REJECTED]: (d) => ({
    title: "KYC Rejected",
    body: `Your identity verification was rejected: ${d.reason}`,
  }),

  [EVENTS.KYB_APPROVED]: () => ({
    title: "Business Verified ✅",
    body: "Your business verification has been approved. Your spots are now live.",
  }),
  [EVENTS.KYB_REJECTED]: (d) => ({
    title: "KYB Rejected",
    body: `Your business verification was rejected: ${d.reason}`,
  }),

  [EVENTS.SPOT_AVAILABLE]: (d) => ({
    title: "Spot Now Available 🅿️",
    body: `A parking spot near ${d.location} is now available.`,
  }),
  [EVENTS.SPOT_UNAVAILABLE]: (d) => ({
    title: "Spot Unavailable",
    body: `The spot ${d.spotName} has been marked as unavailable.`,
  }),
};

// ─── Save notification to database ──────────────────────────────────────────

/**
 * Save a notification to the user_notifications table.
 *
 * @param {string} userId  - The recipient's user ID
 * @param {string} title   - Notification title
 * @param {string} body    - Notification body
 * @param {object} data    - Extra payload (event, metadata, etc.)
 */
const saveNotificationToDb = async (userId, title, body, data = {}) => {
  try {
    await db.query(
      `INSERT INTO user_notifications (user_id, title, body, data)
       VALUES ($1, $2, $3, $4)`,
      [userId, title, body, JSON.stringify(data)],
    );
    console.log(`[Notifications] Saved notification for user ${userId}`);
  } catch (err) {
    console.error(
      `[Notifications] Failed to save notification to DB:`,
      err.message,
    );
  }
};

// ─── Core fire function ──────────────────────────────────────────────────────

/**
 * Fire a notification event to a user (all their active devices).
 *
 * @param {string} eventName  - One of the EVENTS constants
 * @param {number} userId     - The recipient's user ID
 * @param {object} data       - Template variables (spotName, date, amount, etc.)
 *
 * @example
 * await fireEvent(EVENTS.BOOKING_CONFIRMED, user.id, {
 *   spotName: 'Lot A - Colombo 03',
 *   date: '2026-05-01',
 * });
 */
const fireEvent = async (eventName, userId, data = {}) => {
  console.log(`[Notifications] Firing event ${eventName} for user ${userId}`);
  if (!userId) return;

  const template = templates[eventName];
  if (!template) {
    console.error(`[Notifications] Unknown event: ${eventName}`);
    return;
  }

  try {
    // Fetch all active tokens for this user
    const { rows } = await db.query(
      `SELECT fcm_token FROM user_fcm_tokens
       WHERE user_id = $1 AND is_active = TRUE`,
      [userId],
    );

    const { title, body } = template(data);

    // Save notification to database regardless of FCM tokens
    await saveNotificationToDb(userId, title, body, {
      event: eventName,
      userId,
      ...data,
    });

    if (!rows.length) {
      console.log(`[Notifications] No active tokens for user ${userId}`);
      return;
    }

    const fcmTokens = rows.map((r) => r.fcm_token);
    console.log(`[FCM] User ${userId} with tokens:`, fcmTokens);
    await sendMulticast(fcmTokens, title, body, {
      event: eventName,
      userId,
      ...data,
    });
  } catch (err) {
    console.error(
      `[Notifications] fireEvent error (${eventName}):`,
      err.message,
    );
  }
};

module.exports = { EVENTS, fireEvent, saveNotificationToDb };
