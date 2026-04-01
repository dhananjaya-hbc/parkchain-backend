// src/controllers/PaymentController.js
const xrplService = require('../services/XrplService');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
require('dotenv').config();

// GET /api/payments/balance
const getBalance = async (req, res) => {
  try {
    const walletAddress = await User.getWalletAddress(req.user.id);

    if (!walletAddress) {
      return res.status(400).json({
        error: 'No wallet linked to your account. Please login with Xaman.',
        code: 'NO_WALLET'
      });
    }

    const balance = await xrplService.getBalance(walletAddress);

    res.json({
      walletAddress,
      balanceXrp: balance
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

// GET /api/payments/seller/transactions
const getSellerTransactions = async (req, res) => {
  try {
    const sellerId = req.user.id;
    console.log('🔍 Fetching transactions for seller ID:', sellerId);

    const transactions = await Transaction.findBySellerId(sellerId);
    console.log('📊 Found transactions:', transactions.length);

    const earnings = await Transaction.getSellerEarnings(sellerId);

    res.json({
      transactions,
      total: transactions.length,
      earnings
    });
  } catch (error) {
    console.error('❌ Get seller transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch seller transactions.' });
  }
};

module.exports = {
  getBalance,
  getAdminBalance,
  getTransactions,
  getSellerTransactions,
  verifyTransaction
};