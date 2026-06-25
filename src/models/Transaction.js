// src/models/Transaction.js

// Records every XRPL blockchain transaction in our database

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


  // Get transactions for a specific seller (only their spots)
  static async findBySellerId(sellerId, limit = 50, offset = 0) {
    const result = await query(
      `SELECT t.*, 
            b.spot_id,
            b.driver_id,
            s.title AS spot_title,
            s.owner_id,
            d.name AS driver_name
     FROM transactions t
     JOIN bookings b ON t.booking_id = b.id
     JOIN spots s ON b.spot_id = s.id
     JOIN users d ON b.driver_id = d.id
     WHERE s.owner_id = $1 
       AND t.tx_type = 'admin_to_seller'
       AND t.status = 'validated'
     ORDER BY t.created_at DESC
     LIMIT $2 OFFSET $3`,
      [sellerId, limit, offset]
    );
    return result.rows;
  }

  // Get seller earnings summary
  static async getSellerEarnings(sellerId) {
    const result = await query(
      `SELECT
       COUNT(*) AS total_transactions,
       COALESCE(SUM(amount_xrp), 0) AS total_earned_xrp
     FROM transactions t
     JOIN bookings b ON t.booking_id = b.id
     JOIN spots s ON b.spot_id = s.id
     WHERE s.owner_id = $1
       AND t.tx_type = 'admin_to_seller'
       AND t.status = 'validated'`,
      [sellerId]
    );
    return result.rows[0];
  }

  // Get seller earnings series for dashboard chart
  static async getSellerEarningsSeries(sellerId, period = 'week') {
    const sellerTxCte = `WITH seller_tx AS (
    SELECT t.created_at, t.amount_xrp
    FROM transactions t
    JOIN bookings b ON t.booking_id = b.id
    JOIN spots s ON b.spot_id = s.id
    WHERE s.owner_id = $1
      AND t.tx_type = 'admin_to_seller'
      AND t.status = 'validated'
  )`;

    const config = {
      week: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        sql: `${sellerTxCte},
        days AS (
          SELECT generate_series(
            date_trunc('week', NOW()),
            date_trunc('week', NOW()) + INTERVAL '6 day',
            INTERVAL '1 day'
          ) AS bucket_start
        )
        SELECT COALESCE(SUM(st.amount_xrp), 0) AS total
        FROM days d
        LEFT JOIN seller_tx st
          ON st.created_at >= d.bucket_start
         AND st.created_at < d.bucket_start + INTERVAL '1 day'
        GROUP BY d.bucket_start
        ORDER BY d.bucket_start`,
      },
      month: {
        labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
        sql: `${sellerTxCte},
        weeks AS (
          SELECT generate_series(
            date_trunc('week', NOW()) - INTERVAL '3 week',
            date_trunc('week', NOW()),
            INTERVAL '1 week'
          ) AS bucket_start
        )
        SELECT COALESCE(SUM(st.amount_xrp), 0) AS total
        FROM weeks w
        LEFT JOIN seller_tx st
          ON st.created_at >= w.bucket_start
         AND st.created_at < w.bucket_start + INTERVAL '1 week'
        GROUP BY w.bucket_start
        ORDER BY w.bucket_start`,
      },
      year: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        sql: `${sellerTxCte},
        months AS (
          SELECT generate_series(1, 12) AS month_no
        )
        SELECT COALESCE(SUM(st.amount_xrp), 0) AS total
        FROM months m
        LEFT JOIN seller_tx st
          ON EXTRACT(MONTH FROM st.created_at)::INT = m.month_no
         AND EXTRACT(YEAR FROM st.created_at) = EXTRACT(YEAR FROM NOW())
        GROUP BY m.month_no
        ORDER BY m.month_no`,
      },
    };

    const selected = config[period] || config.year;
    const result = await query(selected.sql, [sellerId]);

    return {
      labels: selected.labels,
      values: result.rows.map((row) => Number(row.total)),
    };
  }

  // Get admin revenue series for dashboard chart
  static async getAdminRevenueSeries(period = 'week') {
    const adminTxCte = `WITH admin_tx AS (
    SELECT t.created_at, t.amount_xrp
    FROM transactions t
    WHERE t.tx_type = 'driver_to_admin'
      AND t.status = 'validated'
  )`;
    const config = {
      week: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        sql: `${adminTxCte},
        days AS (
          SELECT generate_series(
            date_trunc('week', NOW()),
            date_trunc('week', NOW()) + INTERVAL '6 day',
            INTERVAL '1 day'
          ) AS bucket_start
        )
        SELECT COALESCE(SUM(at.amount_xrp), 0) AS total
        FROM days d
        LEFT JOIN admin_tx at
          ON at.created_at >= d.bucket_start
         AND at.created_at < d.bucket_start + INTERVAL '1 day'
        GROUP BY d.bucket_start
        ORDER BY d.bucket_start`,
      },
      month: {
        labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
        sql: `${adminTxCte},
        weeks AS (
          SELECT generate_series(
            date_trunc('week', NOW()) - INTERVAL '3 week',
            date_trunc('week', NOW()),
            INTERVAL '1 week'
          ) AS bucket_start
        )
        SELECT COALESCE(SUM(at.amount_xrp), 0) AS total
        FROM weeks w
        LEFT JOIN admin_tx at
          ON at.created_at >= w.bucket_start
         AND at.created_at < w.bucket_start + INTERVAL '1 week'
        GROUP BY w.bucket_start
        ORDER BY w.bucket_start`,
      },
      year: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        sql: `${adminTxCte},
        months AS (
          SELECT generate_series(1, 12) AS month_no
        )
        SELECT COALESCE(SUM(at.amount_xrp), 0) AS total
        FROM months m
        LEFT JOIN admin_tx at
          ON EXTRACT(MONTH FROM at.created_at)::INT = m.month_no
         AND EXTRACT(YEAR FROM at.created_at) = EXTRACT(YEAR FROM NOW())
        GROUP BY m.month_no
        ORDER BY m.month_no`,
      },
    };
    const selected = config[period] || config.year;
    const result = await query(selected.sql);
    return {
      labels: selected.labels,
      values: result.rows.map((row) => Number(row.total)),
    };
  }
}

module.exports = Transaction;