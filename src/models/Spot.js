// src/models/Spot.js
// ============================================
// SPOT MODEL
// ============================================
// Handles all database operations for parking spots
//
// Why use a Model?
// ────────────────
// Instead of writing SQL queries directly in controllers,
// we put them in a Model. This way:
//   - SQL is in one place (easy to find and fix)
//   - Controllers stay clean (just call model methods)
//   - We can reuse queries across different controllers
//
// Pattern: Static methods on a class
//   Spot.create({...})     → INSERT
//   Spot.findById(id)      → SELECT by ID
//   Spot.findAvailable()   → SELECT available spots

const { query } = require('../config/db');

class Spot {
  // ============================================
  // CREATE a new spot
  // ============================================
  // Called when seller submits a new parking spot
  // Note: is_approved defaults to false (admin must approve)
  static async create({
    ownerId, title, description, address,
    latitude, longitude, pricePerHour,
    imageUrls, totalSlots
  }) {
    const result = await query(
      `INSERT INTO spots
         (owner_id, title, description, address, latitude, longitude,
          price_per_hour, image_urls, total_slots, available_slots)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING *`,
      [
        ownerId, title, description, address,
        latitude, longitude, pricePerHour,
        imageUrls || [], totalSlots || 1
      ]
    );
    // $9, $9 means total_slots and available_slots start with the same value
    return result.rows[0];
  }

  // ============================================
  // FIND spot by ID (with owner details)
  // ============================================
  // JOIN: combines data from spots and users tables
  // Without JOIN: you'd need 2 separate queries
  //   Query 1: SELECT * FROM spots WHERE id = ...
  //   Query 2: SELECT * FROM users WHERE id = spot.owner_id
  // With JOIN: one query gets both!
  static async findById(id) {
    const result = await query(
      `SELECT s.*, 
              u.name AS owner_name, 
              u.wallet_address AS owner_wallet,
              u.email AS owner_email
       FROM spots s
       JOIN users u ON s.owner_id = u.id
       WHERE s.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // FIND all available spots (for drivers to browse)
  // ============================================
  // Only shows spots that are:
  //   - Available (seller hasn't deactivated)
  //   - Approved (admin has verified)
  //   - Have free slots
  static async findAvailable() {
    const result = await query(
      `SELECT s.*, u.name AS owner_name
       FROM spots s
       JOIN users u ON s.owner_id = u.id
       WHERE s.is_available = true 
         AND s.is_approved = true
         AND s.available_slots > 0
       ORDER BY s.created_at DESC`
    );
    return result.rows;
  }

  // ============================================
  // FIND spots by owner (seller's own spots)
  // ============================================
  // Seller sees ALL their spots (including unapproved ones)
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
  // Admin sees everything, including unapproved spots
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
  // FIND unapproved spots (admin - pending approval)
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
  // DECREMENT available slots (when someone books)
  // ============================================
  // Also sets is_available = false if no slots left
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
  // INCREMENT available slots (when booking ends/cancelled)
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
    // LEAST(a, b) returns the smaller value
    // Prevents available_slots from exceeding total_slots
    return result.rows[0] || null;
  }

  // ============================================
  // UPDATE spot details (seller action)
  // ============================================
  static async update(spotId, ownerId, updates) {
    const { title, description, address, latitude, longitude, 
            pricePerHour, imageUrls, totalSlots } = updates;

    const result = await query(
      `UPDATE spots
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           address = COALESCE($3, address),
           latitude = COALESCE($4, latitude),
           longitude = COALESCE($5, longitude),
           price_per_hour = COALESCE($6, price_per_hour),
           image_urls = COALESCE($7, image_urls),
           total_slots = COALESCE($8, total_slots),
           updated_at = NOW()
       WHERE id = $9 AND owner_id = $10
       RETURNING *`,
      [title, description, address, latitude, longitude,
       pricePerHour, imageUrls, totalSlots, spotId, ownerId]
    );
    // COALESCE($1, title) means: use $1 if provided, otherwise keep existing value
    // This allows partial updates (only update fields that were sent)
    return result.rows[0] || null;
  }
}

module.exports = Spot;