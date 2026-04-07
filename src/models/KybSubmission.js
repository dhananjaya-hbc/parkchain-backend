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
      `SELECT k.*, TO_CHAR(k.created_at, 'DD Mon YYYY') AS date, u.name AS owner_name, u.email AS owner_email
       FROM kyb_submissions k
       JOIN users u ON k.owner_id = u.id
       WHERE k.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // GET ALL submissions (for admin)
  // ============================================
  static async findAll() {
    const result = await query(
      `SELECT 
          id, 
          entity_name AS "entityName", 
          spot_type AS "spotType", 
          address, 
          TO_CHAR(created_at, 'DD Mon YYYY') AS date, 
          status 
       FROM kyb_submissions 
       ORDER BY created_at ASC`
    );
    return result.rows;
  }

  // ============================================
  // GET ALL submissions for a specific owner
  // ============================================
  static async findByOwnerId(ownerId) {
    const result = await query(
      `SELECT id, entity_name, status, admin_notes 
       FROM kyb_submissions 
       WHERE owner_id = $1 
       ORDER BY created_at DESC`,
      [ownerId]
    );
    return result.rows;
  }

  // ============================================
  // UPDATE submission status
  // ============================================
  static async updateStatus(id, status, adminNotes) {
    const result = await query(
      `UPDATE kyb_submissions
       SET status = $1, admin_notes = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, adminNotes !== undefined ? adminNotes : null, id]
    );
    return result.rows[0] || null;
  }
}

module.exports = KybSubmission;
