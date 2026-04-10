// src/models/Booking.js
// ============================================
// BOOKING MODEL
// ============================================
// Handles all database operations for bookings

const { query } = require('../config/db');

class Booking {
  // ============================================
  // CREATE a new booking
  // ============================================
  static async create({
    driverId, spotId, ownerId,
    startTime, endTime, expectedDurationHours,
    vehicleType,       
    pricePerHour,      
    expectedPriceXrp, totalPriceXrp,
    adminFeeXrp, sellerAmountXrp, vehicleNumber
  }) {
    const result = await query(
      `INSERT INTO bookings
         (driver_id, spot_id, owner_id,
          start_time, end_time, expected_duration_hours,
          vehicle_type, price_per_hour, expected_price_xrp, total_price_xrp,
          admin_fee_xrp, seller_amount_xrp, vehicle_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        driverId, spotId, ownerId,
        startTime, endTime, expectedDurationHours,
        vehicleType,      
        pricePerHour,
        expectedPriceXrp, totalPriceXrp,
        adminFeeXrp, sellerAmountXrp, vehicleNumber
      ]
    );
    return result.rows[0];
  }


  // ============================================
  // FIND booking by ID (with full details)
  // ============================================
  static async findById(id) {
    const result = await query(
      `SELECT b.*,
              b.actual_start_time + (b.expected_duration_hours * INTERVAL '1 hour') AS expiry_time,
              s.title AS spot_title, 
              s.address AS spot_address,
              s.latitude AS spot_latitude,
              s.longitude AS spot_longitude,
              s.image_urls AS spot_images,
              d.name AS driver_name, 
              d.email AS driver_email,
              d.wallet_address AS driver_wallet,
              o.name AS owner_name,
              o.email AS owner_email,
              o.wallet_address AS owner_wallet
       FROM bookings b
       JOIN spots s ON b.spot_id = s.id
       JOIN users d ON b.driver_id = d.id
       JOIN users o ON b.owner_id = o.id
       WHERE b.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // FIND bookings by driver
  // ============================================
  static async findByDriver(driverId, status = null) {
    let sql = `
      SELECT b.*, 
             b.actual_start_time + (b.expected_duration_hours * INTERVAL '1 hour') AS expiry_time,
             s.title AS spot_title, 
             s.address AS spot_address,
             s.latitude AS spot_latitude,
             s.longitude AS spot_longitude,
             o.name AS owner_name
      FROM bookings b
      JOIN spots s ON b.spot_id = s.id
      JOIN users o ON b.owner_id = o.id
      WHERE b.driver_id = $1`;
    
    const params = [driverId];

    if (status) {
      sql += ' AND b.booking_status = $2';
      params.push(status);
    }

    sql += ' ORDER BY b.created_at DESC';

    const result = await query(sql, params);
    return result.rows;
  }

  // ============================================
  // FIND bookings by owner (seller)
  // ============================================
  static async findByOwner(ownerId, status = null) {
    let sql = `
      SELECT b.*, 
             b.actual_start_time + (b.expected_duration_hours * INTERVAL '1 hour') AS expiry_time,
             s.title AS spot_title,
             d.name AS driver_name,
             d.email AS driver_email,
             d.phone AS driver_phone
      FROM bookings b
      JOIN spots s ON b.spot_id = s.id
      JOIN users d ON b.driver_id = d.id
      WHERE b.owner_id = $1`;

    const params = [ownerId];

    if (status) {
      sql += ' AND b.booking_status = $2';
      params.push(status);
    }

    sql += ' ORDER BY b.created_at DESC';

    const result = await query(sql, params);
    return result.rows;
  }

  // ============================================
  // FIND all bookings (admin)
  // ============================================
  static async findAll() {
    const result = await query(
      `SELECT b.*,
              b.actual_start_time + (b.expected_duration_hours * INTERVAL '1 hour') AS expiry_time,
              s.title AS spot_title,
              d.name AS driver_name,
              o.name AS owner_name
       FROM bookings b
       JOIN spots s ON b.spot_id = s.id
       JOIN users d ON b.driver_id = d.id
       JOIN users o ON b.owner_id = o.id
       ORDER BY b.created_at DESC`
    );
    return result.rows;
  }

  // ============================================
  // UPDATE booking status
  // ============================================
  static async updateStatus(id, bookingStatus) {
    const result = await query(
      `UPDATE bookings
       SET booking_status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [bookingStatus, id]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // UPDATE payment status
  // ============================================
  static async updatePaymentStatus(id, paymentStatus) {
    const result = await query(
      `UPDATE bookings
       SET payment_status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [paymentStatus, id]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // CHECK IN - driver arrives at the spot
  // ============================================
  static async checkIn(id) {
    const result = await query(
      `UPDATE bookings
       SET actual_start_time = NOW(),
           booking_status = 'active',
           updated_at = NOW()
       WHERE id = $1 AND booking_status = 'confirmed'
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // CHECK OUT THE BOOKING (Sets status to 'completed')
  // ============================================
  static async checkOut(id) {
    const booking = await query(
      'SELECT * FROM bookings WHERE id = $1 AND booking_status = $2',
      [id, 'active']
    );

    if (booking.rows.length === 0) return null;

    const b = booking.rows[0];
    const now = new Date();
    const actualStart = new Date(b.actual_start_time);

    // Calculate actual duration in hours
    const actualDurationMs = now - actualStart;
    const actualDurationHours = parseFloat(
      (actualDurationMs / (1000 * 60 * 60)).toFixed(2)
    );

    // Calculate overtime
    const expectedHours = parseFloat(b.expected_duration_hours);
    const overtimeHours = Math.max(0, 
      parseFloat((actualDurationHours - expectedHours).toFixed(2))
    );

    // Calculate prices
    const pricePerHour = parseFloat(b.price_per_hour);
    const overtimePrice = parseFloat((overtimeHours * pricePerHour).toFixed(6));
    const totalPrice = parseFloat(
      (parseFloat(b.expected_price_xrp) + overtimePrice).toFixed(6)
    );
    const adminFee = parseFloat((totalPrice * 0.20).toFixed(6));
    const sellerAmount = parseFloat((totalPrice * 0.80).toFixed(6));

    // Update the booking and SET TO COMPLETED
    const result = await query(
      `UPDATE bookings
       SET actual_end_time = NOW(),
           actual_duration_hours = $1,
           overtime_hours = $2,
           overtime_price_xrp = $3,
           total_price_xrp = $4,
           admin_fee_xrp = $5,
           seller_amount_xrp = $6,
           booking_status = 'completed',
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [actualDurationHours, overtimeHours, overtimePrice,
       totalPrice, adminFee, sellerAmount, id]
    );

    return result.rows[0] || null;
  }

  // ============================================
  // CANCEL booking
  // ============================================
  static async cancel(id, userId) {
    const result = await query(
      `UPDATE bookings
       SET booking_status = 'cancelled', updated_at = NOW()
       WHERE id = $1 
         AND (driver_id = $2 OR owner_id = $2)
         AND booking_status IN ('pending', 'confirmed')
       RETURNING *`,
      [id, userId]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // COUNT OVERLAPPING BOOKINGS
  // ============================================
  static async countOverlapping(spotId, startTime, endTime, excludeBookingId = null) {
    let sql = `
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE spot_id = $1 
        AND start_time < $3 
        AND end_time > $2
        AND booking_status IN ('pending', 'confirmed', 'active')
    `;
    const params = [spotId, startTime, endTime];

    if (excludeBookingId) {
      sql += ` AND id != $4`;
      params.push(excludeBookingId);
    }

    const result = await query(sql, params);
    return parseInt(result.rows[0].count);
  }
}

module.exports = Booking;