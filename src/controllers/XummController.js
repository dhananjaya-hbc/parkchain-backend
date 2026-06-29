// src/controllers/XummController.js
const jwt = require('jsonwebtoken');
const xummService = require('../services/XummService');
const User = require('../models/User');
require('dotenv').config();
const { EVENTS, fireEvent } = require('../events/NotificationEvents');

// ── Helper: Generate JWT token ────────────────────────
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ============================================
// POST /api/auth/xumm/login
// ============================================
const login = async (req, res) => {
  try {
    // Ask Xaman to create a sign-in request
    const payload = await xummService.createSignInPayload();

    // Return deepLink + uuid to Flutter
    res.json({
      message: 'Open Xaman app to sign in',
      uuid: payload.uuid,
      deepLink: payload.deepLink,
      qrUrl: payload.qrUrl
    });
  } catch (error) {
    console.error('XUMM login error:', error.message);
    res.status(500).json({
      error: 'Failed to create Xaman sign-in request.'
    });
  }
};

// ============================================
// POST /api/auth/xumm/verify
// ============================================
const verify = async (req, res) => {
  try {
    const { uuid } = req.body;

    // ── Validate ──────────────────────────────────────
    if (!uuid) {
      return res.status(400).json({
        error: 'uuid is required.'
      });
    }

    // ── Check if driver signed in Xaman ───────────────
    const result = await xummService.verifyPayload(uuid);

    if (!result.signed) {
      return res.status(401).json({
        error: 'Sign-in not completed.',
        reason: result.reason
      });
    }

    const walletAddress = result.walletAddress;
    console.log(`Xaman sign-in verified: ${walletAddress}`);

    // ── Find or create user ───────────────────────────
    let user = await User.findByWalletAddress(walletAddress);

    if (user) {
      console.log(`Existing user logged in: ${walletAddress}`);
    } else {
      user = await User.createXamanUser({
        walletAddress,
        role: 'driver'
      });
      console.log(`New user registered: ${walletAddress}`);
    }

    // ── Generate JWT token ────────────────────────────
    const token = generateToken(user.id, user.role);

    res.json({
      message: 'Xaman login successful!',
      token,        // Flutter stores this for future requests
      user,
      walletAddress
    });
  } catch (error) {
    console.error('XUMM verify error:', error.message);
    res.status(500).json({
      error: 'Failed to verify Xaman sign-in.'
    });
  }
};

// ============================================
// Creates Xaman payment request
// ============================================
const createPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;

    // ── Check 1: bookingId provided? ─────────────────
    if (!bookingId) {
      return res.status(400).json({
        error: 'bookingId is required.'
      });
    }

    // ── Check 2: Valid JWT token? ─────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    const jwtPayload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(jwtPayload.userId);

    if (!user) {
      return res.status(401).json({
        error: 'User not found.'
      });
    }

    // ── Check 3: Booking exists? ──────────────────────
    const Booking = require('../models/Booking');
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        error: 'Booking not found.'
      });
    }

    // ── Check 4: Booking belongs to this driver? ──────
    if (booking.driver_id !== user.id) {
      return res.status(403).json({
        error: 'This booking does not belong to you.'
      });
    }

    // ── Check 5: Not already paid? ────────────────────
    if (booking.payment_status !== 'unpaid') {
      return res.status(400).json({
        error: `Payment already ${booking.payment_status}.`
      });
    }

    // ── Check 6: Admin wallet configured? ─────────────
    const adminAddress = process.env.ADMIN_WALLET_ADDRESS;
    if (!adminAddress) {
      return res.status(500).json({
        error: 'Admin wallet not configured.'
      });
    }

    // ── Convert XRP to drops ──────────────────────────
    const totalXrp = parseFloat(booking.total_price_xrp);
    const amountDrops = Math.floor(totalXrp * 1000000).toString();

    // ── Create Xaman payment request ──────────────────
    const payload = await xummService.createPaymentPayload(
      user.wallet_address,
      adminAddress,
      amountDrops,
      bookingId
    );

    // ── Update booking: unpaid → processing ───────────
    await Booking.updatePaymentStatus(bookingId, 'processing');

    res.json({
      message: 'Payment request created. Approve in Xaman app.',
      uuid: payload.uuid,
      deepLink: payload.deepLink,
      qrUrl: payload.qrUrl,
      bookingId,
      amount: totalXrp,
      destination: adminAddress,
    });

  } catch (error) {
    console.error('Create payment error:', error.message);
    res.status(500).json({
      error: 'Failed to create payment request.'
    });
  }
};

// ============================================
// Verifies payment + auto-pays seller 80%
// ============================================
const verifyPayment = async (req, res) => {
  try {
    const { uuid, bookingId } = req.body;

    // ── Validate required fields ──────────────────────
    if (!uuid || !bookingId) {
      return res.status(400).json({
        error: 'uuid and bookingId are required.'
      });
    }

    // ── Verify JWT token ──────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided.'
      });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET);

    // ── Check if driver approved in Xaman ─────────────
    const result = await xummService.verifyPayload(uuid);

    if (!result.signed) {
      // Driver REJECTED payment
      const Booking = require('../models/Booking');
      await Booking.updatePaymentStatus(bookingId, 'failed');
      await Booking.updateStatus(bookingId, 'cancelled');

      return res.status(400).json({
        error: 'Payment not signed.',
        reason: result.reason
      });
    }

    console.log(`Payment signed by: ${result.walletAddress}`);

    // ── Get booking details ───────────────────────────
    const Booking = require('../models/Booking');
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        error: 'Booking not found.'
      });
    }

    // ── Get transaction hash from blockchain ──────────
    const payloadDetails = await xummService.getPayloadDetails(uuid);
    const txHash = payloadDetails?.response?.txid || null;
    console.log(`Transaction hash: ${txHash}`);

    // ── Setup constants ───────────────────────────────
    const Transaction = require('../models/Transaction');
    const totalXrp = parseFloat(booking.total_price_xrp);
    const adminAddress = process.env.ADMIN_WALLET_ADDRESS;

    // ── STEP 1: Record Driver → Admin transaction ─────
    if (txHash) {
      await Transaction.create({
        bookingId,
        txHash,
        fromAddress: result.walletAddress,
        toAddress: adminAddress,
        amountXrp: totalXrp,
        amountDrops: Math.floor(totalXrp * 1000000),
        txType: 'driver_to_admin',
        status: 'validated',
        ledgerIndex: 0,
        resultCode: 'tesSUCCESS'
      });
    }

    // ── STEP 2: Auto-pay Seller 80% ───────────────────
    const sellerAmount = parseFloat(booking.seller_amount_xrp);
    const adminCommission = parseFloat(booking.admin_fee_xrp);
    const xrplService = require('../services/XrplService');

    const adminToSellerTx = await xrplService.paySeller(
      booking.owner_wallet,
      sellerAmount,
      bookingId
    );

    // ── If seller payment successful ──────────────────
    if (adminToSellerTx.success) {

      // ── Record Admin → Seller transaction ──────────
      await Transaction.create({
        bookingId,
        txHash: adminToSellerTx.txHash,
        fromAddress: adminAddress,
        toAddress: booking.owner_wallet,
        amountXrp: sellerAmount,
        amountDrops: Math.floor(sellerAmount * 1000000),
        txType: 'admin_to_seller',
        status: 'validated',
        ledgerIndex: 0,
        resultCode: adminToSellerTx.resultCode
      });

      // ── Update booking status ───────────────────────
      await Booking.updateStatus(bookingId, 'confirmed');
      await Booking.updatePaymentStatus(bookingId, 'split_completed');

      console.log('Payment fully processed!');

      //--Push Notification--to--driver
      await fireEvent(EVENTS.BOOKING_CONFIRMED_DRIVER, booking.driver_id, {
        spotName: booking.spot_title,
        date: booking.start_time.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
      });
      //---To---owner
      await fireEvent(EVENTS.BOOKING_CONFIRMED_OWNER, booking.owner_id, {
        spotName: booking.spot_title,
        date: booking.start_time.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
      });

      // ── Return success to Flutter ───────────────────
      res.json({
        message: 'Payment successful! Booking confirmed.',
        booking: {
          id: bookingId,
          spotTitle: booking.spot_title,
          bookingStatus: 'confirmed',
          paymentStatus: 'split_completed'
        },
        payment: {
          totalPaid: totalXrp,
          adminCommission,
          sellerReceived: sellerAmount,
          transactions: {
            driverToAdmin: {
              txHash,
              amount: totalXrp,
              verifyUrl: txHash
                ? `https://testnet.xrpl.org/transactions/${txHash}`
                : null
            },
            adminToSeller: {
              txHash: adminToSellerTx.txHash,
              amount: sellerAmount,
              verifyUrl: `https://testnet.xrpl.org/transactions/${adminToSellerTx.txHash}`
            }
          }
        }
      });

    } else {
      // ── Seller payment FAILED ─────────────────────
      console.error('Admin → Seller payment failed');
      await Booking.updatePaymentStatus(bookingId, 'failed');
      await Booking.updateStatus(bookingId, 'cancelled');

      res.status(500).json({
        error: 'Seller payout failed. Please contact support.'
      });
    }

  } catch (error) {
    console.error('Verify payment error:', error.message);
    res.status(500).json({
      error: 'Payment verification failed: ' + error.message
    });
  }
};

module.exports = {
  login,
  verify,
  createPayment,
  verifyPayment,
};