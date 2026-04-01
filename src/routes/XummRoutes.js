// src/routes/XummRoutes.js
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const xummService = require('../services/XummService');
const User = require('../models/User');
require('dotenv').config();

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
router.post('/login', async (req, res) => {
  try {
    const payload = await xummService.createSignInPayload();

    res.json({
      message: 'Open Xaman app to sign in',
      uuid: payload.uuid,
      deepLink: payload.deepLink,
      qrUrl: payload.qrUrl
    });
  } catch (error) {
    console.error('XUMM login error:', error.message);
    res.status(500).json({ error: 'Failed to create Xaman sign-in request.' });
  }
});

// ============================================
// POST /api/auth/xumm/verify
// ============================================
router.post('/verify', async (req, res) => {
  try {
    const { uuid } = req.body;

    if (!uuid) {
      return res.status(400).json({ error: 'uuid is required.' });
    }

    const result = await xummService.verifyPayload(uuid);

    if (!result.signed) {
      return res.status(401).json({
        error: 'Sign-in not completed.',
        reason: result.reason
      });
    }

    const walletAddress = result.walletAddress;
    console.log(`✅ Xaman sign-in verified: ${walletAddress}`);

    let user = await User.findByWalletAddress(walletAddress);

    if (user) {
      console.log(`🔑 Existing user logged in via Xaman app: ${walletAddress}`);
    } else {
      user = await User.createXamanUser({
        walletAddress: walletAddress,
        role: 'driver'
      });
      console.log(`🆕 New user registered via Xaman app: ${walletAddress}`);
    }

    const token = generateToken(user.id, user.role);

    res.json({
      message: 'Xaman login successful!',
      token,
      user,
      walletAddress
    });
  } catch (error) {
    console.error('XUMM verify error:', error.message);
    res.status(500).json({ error: 'Failed to verify Xaman sign-in.' });
  }
});

// ============================================
// POST /api/auth/xumm/create-payment
// ============================================
router.post('/create-payment', async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required.' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    const jwtPayload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(jwtPayload.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    const Booking = require('../models/Booking');
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (booking.driver_id !== user.id) {
      return res.status(403).json({ error: 'This booking does not belong to you.' });
    }

    if (booking.payment_status !== 'unpaid') {
      return res.status(400).json({ error: `Payment already ${booking.payment_status}.` });
    }

    const adminAddress = process.env.ADMIN_WALLET_ADDRESS;
    if (!adminAddress) {
      return res.status(500).json({ error: 'Admin wallet not configured.' });
    }

    const totalXrp = parseFloat(booking.total_price_xrp);
    const amountDrops = Math.floor(totalXrp * 1000000).toString();

    console.log(`💳 Creating Xaman payment payload:`);
    console.log(`   Booking: ${bookingId}`);
    console.log(`   Amount: ${totalXrp} XRP (${amountDrops} drops)`);
    console.log(`   From: ${user.wallet_address}`);
    console.log(`   To: ${adminAddress}`);

    const payload = await xummService.createPaymentPayload(
      user.wallet_address,
      adminAddress,
      amountDrops,
      bookingId
    );

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
    res.status(500).json({ error: 'Failed to create payment request.' });
  }
});

// ============================================
// POST /api/auth/xumm/verify-payment
// ============================================
router.post('/verify-payment', async (req, res) => {
  try {
    const { uuid, bookingId } = req.body;

    if (!uuid || !bookingId) {
      return res.status(400).json({ error: 'uuid and bookingId are required.' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET);

    const result = await xummService.verifyPayload(uuid);

    if (!result.signed) {
      const Booking = require('../models/Booking');
      await Booking.updatePaymentStatus(bookingId, 'failed');
      return res.status(400).json({
        error: 'Payment not signed.',
        reason: result.reason
      });
    }

    console.log(`✅ Xaman payment signed by: ${result.walletAddress}`);

    const Booking = require('../models/Booking');
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const payloadDetails = await xummService.getPayloadDetails(uuid);
    const txHash = payloadDetails?.response?.txid || null;

    console.log(`🔗 Transaction hash from Xaman: ${txHash}`);

    const Transaction = require('../models/Transaction');
    const totalXrp = parseFloat(booking.total_price_xrp);
    const adminAddress = process.env.ADMIN_WALLET_ADDRESS;

    // Record driver → admin transaction
    if (txHash) {
      await Transaction.create({
        bookingId,
        txHash: txHash,
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

    const sellerAmount = parseFloat(booking.seller_amount_xrp);
    const adminCommission = parseFloat(booking.admin_fee_xrp);

    console.log(`📌 Admin → Seller: ${sellerAmount} XRP (80%)`);

    // ✅ FIXED: Use paySeller instead of sendPayment
    const xrplService = require('../services/XrplService');
    const adminToSellerTx = await xrplService.paySeller(
      booking.owner_wallet,
      sellerAmount,
      bookingId
    );

    if (adminToSellerTx.success) {
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

      await Booking.updateStatus(bookingId, 'confirmed');
      await Booking.updatePaymentStatus(bookingId, 'split_completed');

      console.log('🎉 Xaman payment fully processed!');

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
              txHash: txHash || 'signed_in_xaman',
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
      console.error('❌ Admin → Seller payment failed');
      await Booking.updatePaymentStatus(bookingId, 'failed');
      res.status(500).json({ error: 'Seller payout failed.' });
    }
  } catch (error) {
    console.error('Verify payment error:', error.message);
    res.status(500).json({ error: 'Payment verification failed: ' + error.message });
  }
});

module.exports = router;