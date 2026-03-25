// src/services/XummService.js
// ============================================
// XUMM (XAMAN) AUTHENTICATION SERVICE
// ============================================
//
// Flow:
// 1. createSignInPayload() → Creates a sign-in request
// 2. User signs it in Xaman app
// 3. verifyPayload() → Checks if user signed & gets wallet address
//
// This PROVES the user owns the wallet!

const { XummSdk } = require('xumm-sdk');
require('dotenv').config();

class XummService {
  constructor() {
    this.sdk = new XummSdk(
      process.env.XUMM_API_KEY,
      process.env.XUMM_API_SECRET
    );
    console.log('🔗 XUMM SDK initialized');
  }

  // ============================================
  // STEP 1: Create a sign-in request
  // ============================================
  // This creates a "payload" — a request for the user to sign
  // The user opens Xaman app and approves/rejects it
  async createSignInPayload() {
    try {
      const payload = await this.sdk.payload.create({
        txjson: {
          TransactionType: 'SignIn'
        },
        options: {
          return_url: {
            app: 'parkchain://xaman?uuid={id}',
            web: null
          }
        }
      });

      console.log('📝 XUMM Sign-in payload created');
      console.log(`   UUID: ${payload.uuid}`);
      console.log(`   Deep link: ${payload.next.always}`);
      console.log(`   Return URL: parkchain://xaman?uuid=${payload.uuid}`);

      return {
        uuid: payload.uuid,
        deepLink: payload.next.always,
        qrUrl: payload.refs.qr_png,
        webSocketUrl: payload.refs.websocket_status
      };
    } catch (error) {
      console.error('❌ XUMM payload creation failed:', error.message);
      throw error;
    }
  }
  // ============================================
  // STEP 2: Verify the payload (check if user signed)
  // ============================================
  // After user interacts with Xaman, we check what happened
  async verifyPayload(payloadUuid) {
    try {
      const result = await this.sdk.payload.get(payloadUuid);

      console.log('🔍 XUMM payload status:');
      console.log(`   UUID: ${payloadUuid}`);
      console.log(`   Signed: ${result.meta.signed}`);
      console.log(`   Wallet: ${result.response.account || 'N/A'}`);

      // Check if user signed (approved) the request
      if (!result.meta.signed) {
        return {
          signed: false,
          reason: result.meta.cancelled ? 'User cancelled' : 'Not signed yet'
        };
      }

      // User signed! We now have their PROVEN wallet address
      return {
        signed: true,
        walletAddress: result.response.account,
        userToken: result.response.user_token || null
      };
    } catch (error) {
      console.error('❌ XUMM payload verification failed:', error.message);
      throw error;
    }
  }
    // ============================================
  // Create a PAYMENT payload (not just SignIn)
  // ============================================
  async createPaymentPayload(fromAddress, toAddress, amountDrops, bookingId) {
    try {
      const payload = await this.sdk.payload.create({
        txjson: {
          TransactionType: 'Payment',
          Account: fromAddress,
          Destination: toAddress,
          Amount: amountDrops,
          Memos: [
            {
              Memo: {
                MemoType: Buffer.from('text/plain', 'utf8').toString('hex').toUpperCase(),
                MemoData: Buffer.from(`parkchain:booking:${bookingId}`, 'utf8').toString('hex').toUpperCase()
              }
            }
          ]
        },
        options: {
          return_url: {
            app: `parkchain://payment?bookingId=${bookingId}&uuid={id}`,
            web: null
          }
        }
      });

      console.log('💳 XUMM Payment payload created');
      console.log(`   UUID: ${payload.uuid}`);
      console.log(`   Amount: ${amountDrops} drops`);

      return {
        uuid: payload.uuid,
        deepLink: payload.next.always,
        qrUrl: payload.refs.qr_png,
      };
    } catch (error) {
      console.error('❌ XUMM payment payload failed:', error.message);
      throw error;
    }
  }

  // ============================================
  // Get full payload details (including tx hash)
  // ============================================
  async getPayloadDetails(payloadUuid) {
    try {
      return await this.sdk.payload.get(payloadUuid);
    } catch (error) {
      console.error('❌ Get payload details failed:', error.message);
      return null;
    }
  }
}

// Export singleton
module.exports = new XummService();