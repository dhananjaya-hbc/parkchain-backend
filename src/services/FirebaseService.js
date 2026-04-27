const admin = require('firebase-admin');
const db = require('../config/db');
const serviceAccount = require('../firebase/park-chain-2026-firebase-adminsdk-key.json');
// import admin from 'firebase-admin';
// import db from '../config/db.js';
// import serviceAccount from '../firebase/park-chain-2026-firebase-adminsdk-key.json' assert { type: 'json' };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

/**
 * Send to a single FCM token.
 * Automatically deactivates stale tokens in user_fcm_tokens.
 */
const sendNotification = async (fcmToken, title, body, data = {}) => {
  if (!fcmToken) return null;

  const message = {
    token: fcmToken,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  };

  try {
    const response = await admin.messaging().send(message);

    await db.query(
      `UPDATE user_fcm_tokens SET last_used_at = NOW() WHERE fcm_token = $1`,
      [fcmToken]
    );

    console.log(`[FCM] Sent successfully:`, response);
    return response;
  } catch (err) {
    if (
      err.code === 'messaging/registration-token-not-registered' ||
      err.code === 'messaging/invalid-registration-token'
    ) {
      console.warn(`[FCM] Stale token detected, deactivating: ${fcmToken.slice(0, 20)}...`);
      await db.query(
        `UPDATE user_fcm_tokens SET is_active = FALSE WHERE fcm_token = $1`,
        [fcmToken]
      );
    } else {
      console.error('[FCM] Send error:', err.message);
    }
    return null;
  }
};

/**
 * Send to multiple FCM tokens at once.
 * Automatically deactivates any stale tokens returned by FCM.
 */
const sendMulticast = async (fcmTokens, title, body, data = {}) => {
  if (!fcmTokens?.length) return null;

  const message = {
    tokens: fcmTokens,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(`[FCM] Multicast: ${response.successCount} sent, ${response.failureCount} failed`);

    // Deactivate any stale tokens FCM flagged
    if (response.failureCount > 0) {
      const staleTokens = [];

      response.responses.forEach((res, idx) => {
        if (
          !res.success &&
          (res.error?.code === 'messaging/registration-token-not-registered' ||
            res.error?.code === 'messaging/invalid-registration-token')
        ) {
          staleTokens.push(fcmTokens[idx]);
        }
      });

      if (staleTokens.length > 0) {
        await db.query(
          `UPDATE user_fcm_tokens SET is_active = FALSE WHERE fcm_token = ANY($1)`,
          [staleTokens]
        );
        console.warn(`[FCM] Deactivated ${staleTokens.length} stale token(s)`);
      }
    }

    return response;
  } catch (err) {
    console.error('[FCM] Multicast error:', err.message);
    return null;
  }
};

module.exports = { sendNotification, sendMulticast };