// src/models/Review.js

const { query } = require('../config/db');

class Review {
  // ============================================
  // CREATE a new review
  // ============================================
  static async create({ bookingId, driverId, spotId, rating, comment }) {
    const result = await query(
      `INSERT INTO reviews (booking_id, driver_id, spot_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [bookingId, driverId, spotId, rating, comment]
    );
    return result.rows[0];
  }

  // ============================================
  // FIND review by ID
  // ============================================
  static async findById(id) {
    const result = await query(
      `SELECT r.*, 
              b.id as booking_id,
              d.id as driver_id,
              d.name as driver_name,
              d.profile_image as driver_image,
              s.id as spot_id,
              s.title as spot_title,
              s.address as spot_address,
              u.id as owner_id,
              u.name as owner_name
       FROM reviews r
       LEFT JOIN bookings b ON r.booking_id = b.id
       LEFT JOIN users d ON r.driver_id = d.id
       LEFT JOIN spots s ON r.spot_id = s.id
       LEFT JOIN users u ON s.owner_id = u.id
       WHERE r.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // GET all reviews (for admin)
  // ============================================
  static async findAll({ limit = 20, offset = 0, orderBy = 'created_at DESC' }) {
    const result = await query(
      `SELECT r.*, 
              d.name as driver_name,
              d.profile_image as driver_image,
              s.title as spot_title,
              s.address as spot_address,
              u.name as owner_name
       FROM reviews r
       LEFT JOIN users d ON r.driver_id = d.id
       LEFT JOIN spots s ON r.spot_id = s.id
       LEFT JOIN users u ON s.owner_id = u.id
       ORDER BY ${orderBy}
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  // ============================================
  // GET count of all reviews
  // ============================================
  static async countAll() {
    const result = await query('SELECT COUNT(*) as count FROM reviews');
    return parseInt(result.rows[0].count);
  }

  // ============================================
  // GET reviews for a specific spot (seller view)
  // ============================================
  static async findBySpot(spotId, { limit = 20, offset = 0 }) {
    const result = await query(
      `SELECT r.*, 
              d.name as user_name,
              d.profile_image as user_profile_image,
              s.title as spot_title,
              s.address as spot_address
       FROM reviews r
       LEFT JOIN users d ON r.driver_id = d.id
       LEFT JOIN spots s ON r.spot_id = s.id
       WHERE r.spot_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [spotId, limit, offset]
    );
    return result.rows;
  }

  // ============================================
  // COUNT reviews for a specific spot
  // ============================================
  static async countBySpot(spotId) {
    const result = await query(
      'SELECT COUNT(*) as count FROM reviews WHERE spot_id = $1',
      [spotId]
    );
    return parseInt(result.rows[0].count);
  }

  // ============================================
  // GET average rating for a specific spot
  // ============================================
  static async getAverageRatingBySpot(spotId) {
    const result = await query(
      'SELECT AVG(rating) as average_rating FROM reviews WHERE spot_id = $1',
      [spotId]
    );
    return parseFloat(result.rows[0].average_rating) || 0;
  }

  // ============================================
  // GET reviews given by a specific driver
  // ============================================
  static async findByDriver(driverId, { limit = 20, offset = 0 }) {
    const result = await query(
      `SELECT r.*, 
              s.title as spot_title,
              s.address as spot_address,
              u.name as owner_name
       FROM reviews r
       LEFT JOIN spots s ON r.spot_id = s.id
       LEFT JOIN users u ON s.owner_id = u.id
       WHERE r.driver_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [driverId, limit, offset]
    );
    return result.rows;
  }

  // ============================================
  // COUNT reviews by a specific driver
  // ============================================
  static async countByDriver(driverId) {
    const result = await query(
      'SELECT COUNT(*) as count FROM reviews WHERE driver_id = $1',
      [driverId]
    );
    return parseInt(result.rows[0].count);
  }

  // ============================================
  // GET reviews for all spots owned by a user (seller view)
  // ============================================
  static async findByOwner(ownerId, { limit = 20, offset = 0 }) {
    const result = await query(
      `SELECT r.*, 
              d.name as driver_name,
              d.profile_image as driver_image,
              s.id as spot_id,
              s.title as spot_title,
              s.address as spot_address
       FROM reviews r
       LEFT JOIN users d ON r.driver_id = d.id
       LEFT JOIN spots s ON r.spot_id = s.id
       WHERE s.owner_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [ownerId, limit, offset]
    );
    return result.rows;
  }

  // ============================================
  // COUNT reviews for all spots owned by a user
  // ============================================
  static async countByOwner(ownerId) {
    const result = await query(
      `SELECT COUNT(*) as count FROM reviews r
       LEFT JOIN spots s ON r.spot_id = s.id
       WHERE s.owner_id = $1`,
      [ownerId]
    );
    return parseInt(result.rows[0].count);
  }

  // ============================================
  // UPDATE a review
  // ============================================
  static async update(id, { rating, comment }) {
    const result = await query(
      `UPDATE reviews 
       SET rating = COALESCE($2, rating),
           comment = COALESCE($3, comment)
       WHERE id = $1
       RETURNING *`,
      [id, rating, comment]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // DELETE a review
  // ============================================
  static async delete(id) {
    const result = await query('DELETE FROM reviews WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  }

  // ============================================
  // CHECK if review exists for a booking
  // ============================================
  static async findByBooking(bookingId) {
    const result = await query(
      'SELECT * FROM reviews WHERE booking_id = $1',
      [bookingId]
    );
    return result.rows[0] || null;
  }
}

module.exports = Review;
