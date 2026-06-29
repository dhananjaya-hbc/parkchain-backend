// src/models/Spot.js
const { query } = require('../config/db');

class Spot {
  // ============================================
  // CREATE a new spot
  // ============================================
  static async create({
    ownerId, kybSubmissionId = null, title, description, address,
    latitude, longitude, 
    vehicleTypes,      // ⭐ Array: ['Car', 'Bike', 'Truck']
    slotsPerType,      // ⭐ Array: [2, 3, 1]
    pricesPerHour,     // ⭐ Array: [10.0, 5.0, 15.0]
    imageUrls, totalSlots
  }) {
    const result = await query(
      `INSERT INTO spots
        (owner_id, kyb_submission_id, title, description, address, latitude, longitude,
         vehicle_types, slots_per_type, prices_per_hour, image_urls, total_slots, available_slots, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, true)
       RETURNING *`,
      [
        ownerId, kybSubmissionId, title, description, address,
        latitude, longitude,
        vehicleTypes || ['Car'],
        slotsPerType || [1],
        pricesPerHour || [10.0],
        imageUrls || [],
        totalSlots || 1
      ]
    );
    return result.rows[0];
  }

  // ============================================
  // FIND spot by KYB submission ID
  // ============================================
  static async findByKybSubmissionId(kybSubmissionId) {
    const result = await query(
      `SELECT * FROM spots WHERE kyb_submission_id = $1 LIMIT 1`,
      [kybSubmissionId]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // FIND spot by ID (with owner details)
  // ============================================
  static async findById(id) {
    const result = await query(
      `SELECT s.*, 
              u.name AS owner_name, 
              u.email AS owner_email,
              u.phone AS owner_phone,
              u.created_at AS owner_created_at,
              u.wallet_address AS owner_wallet
       FROM spots s
       JOIN users u ON s.owner_id = u.id
       WHERE s.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // FIND all available spots (for drivers)
  // ============================================
  static async findAvailable() {
    const result = await query(
      `WITH ReviewStats AS (
         SELECT 
           spot_id, 
           AVG(rating) AS average_rating,
           COUNT(id) AS total_reviews
         FROM reviews
         GROUP BY spot_id
       )
       SELECT 
         s.*, 
         u.name AS owner_name,
         COALESCE(rs.average_rating, 0) AS average_rating,
         COALESCE(rs.total_reviews, 0) AS total_reviews
       FROM spots s
       JOIN users u ON s.owner_id = u.id
       LEFT JOIN ReviewStats rs ON s.id = rs.spot_id
       WHERE s.is_available = true
         AND s.is_approved = true
       ORDER BY s.created_at DESC`
    );
    return result.rows;
  }

  // ============================================
  // FIND spots by owner (seller's own spots)
  // ============================================
  static async findByOwner(ownerId) {
    const result = await query(
      `SELECT * FROM spots 
       WHERE owner_id = $1 
       ORDER BY created_at DESC`,
      [ownerId]
    );
    return result.rows;
  }

  // ============================================
  // FIND all spots (admin view)
  // ============================================
  static async findAll() {
    const result = await query(
      `SELECT s.*, u.name AS owner_name, u.email AS owner_email
       FROM spots s
       JOIN users u ON s.owner_id = u.id
       ORDER BY s.created_at DESC`
    );
    return result.rows;
  }

  // ============================================
  // FIND unapproved spots (admin)
  // ============================================
  static async findPendingApproval() {
    const result = await query(
      `SELECT s.*, u.name AS owner_name, u.email AS owner_email
       FROM spots s
       JOIN users u ON s.owner_id = u.id
       WHERE s.is_approved = false
       ORDER BY s.created_at ASC`
    );
    return result.rows;
  }

  // ============================================
  // APPROVE a spot (admin action)
  // ============================================
  static async approve(spotId) {
    const result = await query(
      `UPDATE spots 
       SET is_approved = true, updated_at = NOW() 
       WHERE id = $1
       RETURNING *`,
      [spotId]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // REJECT a spot (admin action)
  // ============================================
  static async reject(spotId) {
    const result = await query(
      `DELETE FROM spots WHERE id = $1 RETURNING *`,
      [spotId]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // DELETE a spot by owner (seller action)
  // ============================================
  static async delete(spotId, ownerId) {
    const result = await query(
      `DELETE FROM spots
       WHERE id = $1 AND owner_id = $2
       RETURNING *`,
      [spotId, ownerId]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // TOGGLE availability (seller action)
  // ============================================
  static async toggleAvailability(spotId, ownerId) {
    const result = await query(
      `UPDATE spots 
       SET is_available = NOT is_available, updated_at = NOW()
       WHERE id = $1 AND owner_id = $2
       RETURNING *`,
      [spotId, ownerId]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // DECREMENT available slots
  // ============================================
  static async decrementSlot(spotId) {
    const result = await query(
      `UPDATE spots
       SET available_slots = available_slots - 1,
           is_available = CASE 
             WHEN available_slots - 1 <= 0 THEN false 
             ELSE true 
           END,
           updated_at = NOW()
       WHERE id = $1 AND available_slots > 0
       RETURNING *`,
      [spotId]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // INCREMENT available slots
  // ============================================
  static async incrementSlot(spotId) {
    const result = await query(
      `UPDATE spots
       SET available_slots = LEAST(available_slots + 1, total_slots),
           is_available = true,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [spotId]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // UPDATE spot details (seller action)
  // ============================================
  static async update(spotId, ownerId, updates) {
    const {
      title, description, address, latitude, longitude,
      vehicleTypes, slotsPerType, pricesPerHour,
      totalSlots, imageUrls,
    } = updates;
    // When slot structure changes, reset available_slots = totalSlots
    // (sweep-line already guarantees this is safe)
    const availableSlots = totalSlots !== undefined ? totalSlots : undefined;

    const result = await query(
      `UPDATE spots
       SET title           = COALESCE($1,  title),
           description     = COALESCE($2,  description),
           address         = COALESCE($3,  address),
           latitude        = COALESCE($4,  latitude),
           longitude       = COALESCE($5,  longitude),
           vehicle_types   = COALESCE($6,  vehicle_types),
           slots_per_type  = COALESCE($7,  slots_per_type),
           prices_per_hour = COALESCE($8,  prices_per_hour),
           total_slots     = COALESCE($9,  total_slots),
           available_slots = COALESCE($10, available_slots),
           image_urls      = COALESCE($11, image_urls),
           updated_at      = NOW()
       WHERE id = $12 AND owner_id = $13
       RETURNING *`,
      [
        title, description, address, latitude, longitude,
        vehicleTypes   || null,
        slotsPerType   || null,
        pricesPerHour  || null,
        totalSlots     !== undefined ? totalSlots     : null,
        availableSlots !== undefined ? availableSlots : null,
        imageUrls      || null,
        spotId, ownerId,
      ]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // ⭐ NEW: Get price for a specific vehicle type
  // ============================================
  static getPriceForVehicle(spot, vehicleType) {
    const vehicleTypes = spot.vehicle_types || ['Car'];
    const pricesPerHour = spot.prices_per_hour || [10.0];
    
    const index = vehicleTypes.indexOf(vehicleType);
    
    if (index === -1) {
      return null; // Vehicle type not supported
    }
    
    return parseFloat(pricesPerHour[index]);
  }
}

module.exports = Spot;