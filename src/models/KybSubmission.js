const { query } = require('../config/db');

class KybSubmission {
  // ============================================
  // CREATE a new KYB Submission
  // ============================================
  static async create({
    ownerId,
    entityName,
    address,
    googleMapsLink,
    spotType,
    documentUrl
  }) {
    const result = await query(
      `INSERT INTO kyb_submissions
         (owner_id, entity_name, address, google_maps_link, spot_type, document_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        ownerId,
        entityName,
        address,
        googleMapsLink,
        spotType,
        documentUrl
      ]
    );
    return result.rows[0];
  }

  // ============================================
  // FIND submission by ID
  // ============================================
  static async findById(id) {
    const result = await query(
      `SELECT * FROM kyb_submissions WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }
}

module.exports = KybSubmission;
