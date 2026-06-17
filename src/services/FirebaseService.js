const admin = require('firebase-admin');
const db = require('../config/db');
// const serviceAccount = require('../firebase/park-chain-2026-firebase-adminsdk-key.json');


const serviceAcc = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
}

if (!admin.apps.length) {
  try {
    if (process.env.NODE_ENV === 'test' || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'mock-project-id'
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(JSON.stringify(serviceAcc))),
      });
    }
  } catch (error) {
    console.error('Firebase Admin SDK failed to initialize:', error.message);
    try {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'mock-project-id'
      });
    } catch (fallbackError) {
      console.error('Firebase fallback initialization failed:', fallbackError.message);
    }
  }
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