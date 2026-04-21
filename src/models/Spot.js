// src/models/Spot.js
const { query } = require('../config/db');

class Spot {
  // ============================================
  // CREATE a new spot
  // ============================================
  static async create({
    ownerId, title, description, address,
    latitude, longitude, 
    vehicleTypes,      
    slotsPerType,      
    pricesPerHour,     
    imageUrls, totalSlots, amenities
  }) {
    const result = await query(
      `INSERT INTO spots
        (owner_id, title, description, address, latitude, longitude,
         vehicle_types, slots_per_type, prices_per_hour, image_urls, amenities, total_slots, available_slots, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, true)
       RETURNING *`,
      [
        ownerId, title, description, address,
        latitude, longitude,
        vehicleTypes || ['Car'],
        slotsPerType || [1],
        pricesPerHour || [10.0],
        imageUrls || [],
        amenities || [],
        totalSlots || 1
      ]
    );
    return result.rows[0];
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
      `SELECT s.*, u.name AS owner_name
       FROM spots s
       JOIN users u ON s.owner_id = u.id
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
    const { title, description, address, latitude, longitude, 
            vehicleTypes, slotsPerType, pricesPerHour,
            imageUrls, totalSlots, amenities } = updates;

    const result = await query(
      `UPDATE spots
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           address = COALESCE($3, address),
           latitude = COALESCE($4, latitude),
           longitude = COALESCE($5, longitude),
           vehicle_types = COALESCE($6, vehicle_types),
             slots_per_type = COALESCE($7, slots_per_type),
             prices_per_hour = COALESCE($8, prices_per_hour),
             image_urls = COALESCE($9, image_urls),
             total_slots = COALESCE($10, total_slots),
             amenities = COALESCE($11, amenities),
           updated_at = NOW()
           WHERE id = $12 AND owner_id = $13
       RETURNING *`,
      [title, description, address, latitude, longitude,
           vehicleTypes, slotsPerType, pricesPerHour,
           imageUrls, totalSlots, amenities, spotId, ownerId]
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