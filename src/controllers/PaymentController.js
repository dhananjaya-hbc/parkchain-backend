// src/controllers/PaymentController.js
const xrplService = require('../services/XrplService');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
require('dotenv').config();

// POST /api/payments/process
const processPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const driverId = req.user.id;

    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required.' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (booking.driver_id !== driverId) {
      return res.status(403).json({ error: 'This booking does not belong to you.' });
    }

    if (booking.payment_status !== 'unpaid') {
      return res.status(400).json({
        error: `Payment already ${booking.payment_status}. Cannot pay again.`
      });
    }

    const driverWallet = await User.getWalletDetails(driverId);

    if (!driverWallet || !driverWallet.wallet_address || !driverWallet.wallet_seed) {
      return res.status(400).json({
        error: 'You do not have a funded XRPL wallet. Generate one first.',
        code: 'NO_WALLET'
      });
    }

    if (!booking.owner_wallet) {
      return res.status(400).json({
        error: 'Spot owner does not have an XRPL wallet. Cannot process payment.',
        code: 'NO_SELLER_WALLET'
      });
    }

    if (!process.env.ADMIN_WALLET_ADDRESS || !process.env.ADMIN_WALLET_SEED) {
      return res.status(500).json({
        error: 'Admin wallet not configured. Contact administrator.'
      });
    }

    await Booking.updatePaymentStatus(bookingId, 'processing');

    console.log(`\n🔄 Processing payment for booking: ${bookingId}`);
    console.log(`   Driver: ${booking.driver_name}`);
    console.log(`   Spot: ${booking.spot_title}`);
    console.log(`   Amount: ${booking.total_price_xrp} XRP`);

    const paymentResult = await xrplService.processBookingPayment(
      driverWallet.wallet_seed,
      booking.owner_wallet,
      parseFloat(booking.total_price_xrp),
      bookingId
    );

    if (!paymentResult.success) {
      await Booking.updatePaymentStatus(bookingId, 'failed');
      console.error(`❌ Payment failed at step: ${paymentResult.failedStep}`);
      return res.status(500).json({
        error: 'Payment failed on XRPL blockchain.',
        failedStep: paymentResult.failedStep,
        resultCode: paymentResult.error
      });
    }

    await Transaction.create({
      bookingId,
      txHash: paymentResult.driverToAdminTx.txHash,
      fromAddress: paymentResult.driverToAdminTx.from,
      toAddress: paymentResult.driverToAdminTx.to,
      amountXrp: paymentResult.totalAmountXrp,
      amountDrops: paymentResult.driverToAdminTx.amountDrops,
      txType: 'driver_to_admin',
      status: 'validated',
      ledgerIndex: paymentResult.driverToAdminTx.ledgerIndex,
      resultCode: paymentResult.driverToAdminTx.resultCode
    });

    await Transaction.create({
      bookingId,
      txHash: paymentResult.adminToSellerTx.txHash,
      fromAddress: paymentResult.adminToSellerTx.from,
      toAddress: paymentResult.adminToSellerTx.to,
      amountXrp: paymentResult.sellerAmount,
      amountDrops: paymentResult.adminToSellerTx.amountDrops,
      txType: 'admin_to_seller',
      status: 'validated',
      ledgerIndex: paymentResult.adminToSellerTx.ledgerIndex,
      resultCode: paymentResult.adminToSellerTx.resultCode
    });

    await Booking.updateStatus(bookingId, 'confirmed');
    await Booking.updatePaymentStatus(bookingId, 'split_completed');

    console.log('🎉 Payment fully processed and recorded!\n');

    res.json({
      message: 'Payment successful! Booking confirmed.',
      booking: {
        id: bookingId,
        spotTitle: booking.spot_title,
        bookingStatus: 'confirmed',
        paymentStatus: 'split_completed'
      },
      payment: {
        totalPaid: paymentResult.totalAmountXrp,
        adminCommission: paymentResult.adminCommission,
        sellerReceived: paymentResult.sellerAmount,
        transactions: {
          driverToAdmin: {
            txHash: paymentResult.driverToAdminTx.txHash,
            amount: paymentResult.totalAmountXrp,
            verifyUrl: `https://testnet.xrpl.org/transactions/${paymentResult.driverToAdminTx.txHash}`
          },
          adminToSeller: {
            txHash: paymentResult.adminToSellerTx.txHash,
            amount: paymentResult.sellerAmount,
            verifyUrl: `https://testnet.xrpl.org/transactions/${paymentResult.adminToSellerTx.txHash}`
          }
        }
      }
    });
  } catch (error) {
    console.error('❌ Payment processing error:', error.message);
    if (req.body.bookingId) {
      await Booking.updatePaymentStatus(req.body.bookingId, 'failed').catch(() => {});
    }
    res.status(500).json({
      error: 'Payment processing failed: ' + error.message
    });
  }
};

// POST /api/payments/generate-wallet
// ★ FIXED: Now checks for wallet_seed, not just wallet_address ★
const generateWallet = async (req, res) => {
  try {
    // Check if user already has a FUNDED wallet (with seed for signing)
    const existing = await User.getWalletDetails(req.user.id);
    if (existing && existing.wallet_address && existing.wallet_seed) {
      return res.status(400).json({
        error: 'You already have a funded wallet.',
        walletAddress: existing.wallet_address
      });
    }

    console.log(`🔑 Generating XRPL wallet for ${req.user.role}: ${req.user.email}`);

    const wallet = await xrplService.generateWallet();

    await User.updateWallet(req.user.id, wallet.address, wallet.seed);

    console.log(`✅ Wallet generated: ${wallet.address}`);

    res.json({
      message: 'XRPL wallet generated successfully!',
      wallet: {
        address: wallet.address,
        balance: wallet.balance
      }
    });
  } catch (error) {
    console.error('Generate wallet error:', error.message);
    res.status(500).json({ error: 'Failed to generate wallet: ' + error.message });
  }
};

// GET /api/payments/balance
const getBalance = async (req, res) => {
  try {
    const walletDetails = await User.getWalletDetails(req.user.id);

    // Check wallet_address (not wallet_seed — Xaman users don't have seed)
    if (!walletDetails || !walletDetails.wallet_address) {
      return res.status(400).json({
        error: 'No wallet linked to your account.',
        code: 'NO_WALLET'
      });
    }

    const balance = await xrplService.getBalance(walletDetails.wallet_address);

    res.json({
      walletAddress: walletDetails.wallet_address,
      balanceXrp: balance,
      hasSeed: !!walletDetails.wallet_seed
    });
  } catch (error) {
    console.error('Get balance error:', error.message);
    res.status(500).json({ error: 'Failed to get balance.' });
  }
};

// GET /api/payments/admin/balance
const getAdminBalance = async (req, res) => {
  try {
    const adminAddress = process.env.ADMIN_WALLET_ADDRESS;

    if (!adminAddress) {
      return res.status(500).json({ error: 'Admin wallet not configured.' });
    }

    const balance = await xrplService.getBalance(adminAddress);
    const earnings = await Transaction.getAdminEarnings();

    res.json({
      adminWallet: adminAddress,
      currentBalance: balance,
      earnings
    });
  } catch (error) {
    console.error('Admin balance error:', error.message);
    res.status(500).json({ error: 'Failed to get admin balance.' });
  }
};

// GET /api/payments/transactions
const getTransactions = async (req, res) => {
  try {
    const { bookingId, limit, offset } = req.query;

    let transactions;
    if (bookingId) {
      transactions = await Transaction.findByBooking(bookingId);
    } else {
      transactions = await Transaction.findAll(
        parseInt(limit) || 50,
        parseInt(offset) || 0
      );
    }

    res.json({ transactions, total: transactions.length });
  } catch (error) {
    console.error('Get transactions error:', error.message);
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
};

// GET /api/payments/verify/:txHash
const verifyTransaction = async (req, res) => {
  try {
    const { txHash } = req.params;
    const result = await xrplService.verifyTransaction(txHash);
    res.json({ transaction: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify transaction.' });
  }
};

module.exports = {
  processPayment,
  generateWallet,
  getBalance,
  getAdminBalance,
  getTransactions,
  verifyTransaction
};