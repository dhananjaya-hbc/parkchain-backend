// src/models/Transaction.js
// ============================================
// TRANSACTION MODEL
// ============================================
// Records every XRPL blockchain transaction in our database
// This gives us a local copy for fast queries
// The blockchain is the source of truth (can verify anytime)

const { query } = require('../config/db');

class Transaction {
  // Create a transaction record
  static async create({
    bookingId, txHash, fromAddress, toAddress,
    amountXrp, amountDrops, txType, status,
    ledgerIndex, resultCode
  }) {
    const result = await query(
      `INSERT INTO transactions
         (booking_id, tx_hash, from_address, to_address,
          amount_xrp, amount_drops, tx_type, status,
          ledger_index, result_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        bookingId, txHash, fromAddress, toAddress,
        amountXrp, amountDrops, txType, status,
        ledgerIndex, resultCode
      ]
    );
    return result.rows[0];
  }

  // Find all transactions for a booking
  static async findByBooking(bookingId) {
    const result = await query(
      'SELECT * FROM transactions WHERE booking_id = $1 ORDER BY created_at',
      [bookingId]
    );
    return result.rows;
  }

  // Find transaction by hash
  static async findByHash(txHash) {
    const result = await query(
      'SELECT * FROM transactions WHERE tx_hash = $1',
      [txHash]
    );
    return result.rows[0] || null;
  }

  // Get all transactions (admin view)
  static async findAll(limit = 50, offset = 0) {
    const result = await query(
      `SELECT t.*, 
              b.spot_id,
              s.title AS spot_title,
              d.name AS driver_name,
              o.name AS owner_name
       FROM transactions t
       JOIN bookings b ON t.booking_id = b.id
       JOIN spots s ON b.spot_id = s.id
       JOIN users d ON b.driver_id = d.id
       JOIN users o ON b.owner_id = o.id
       ORDER BY t.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  // Get admin earnings summary
  static async getAdminEarnings() {
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE tx_type = 'driver_to_admin') AS total_payments,
         COALESCE(SUM(amount_xrp) FILTER (WHERE tx_type = 'driver_to_admin'), 0) AS total_received_xrp,
         COALESCE(SUM(amount_xrp) FILTER (WHERE tx_type = 'admin_to_seller'), 0) AS total_paid_sellers_xrp,
         COALESCE(SUM(amount_xrp) FILTER (WHERE tx_type = 'driver_to_admin'), 0) -
         COALESCE(SUM(amount_xrp) FILTER (WHERE tx_type = 'admin_to_seller'), 0) AS admin_profit_xrp
       FROM transactions
       WHERE status = 'validated'`
    );
    return result.rows[0];
  }
}

module.exports = Transaction;