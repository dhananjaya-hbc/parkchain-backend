// src/models/User.js
const { query } = require('../config/db');

class User {
  // ============================================
  // FIND methods
  // ============================================

  static async findById(id) {
    const result = await query(
      `SELECT id, email, name, phone, role, wallet_address,
              profile_image, kyc_status, created_at, auth_type, license_no, vehicle_type
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }
  
  // Used for admin login to get hashed password
  static async findAdminByIdWithPassword(id) {
    const result = await query(
      'SELECT id, password, role FROM users WHERE id = $1 AND role = $2',
      [id, 'admin']
    );
    return result.rows[0] || null;
  }


  static async findByEmail(email) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  // Primary login method — find by Xaman wallet address
  static async findByWalletAddress(walletAddress) {
    const result = await query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [walletAddress]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // CREATE methods
  // ============================================

  static async createXamanUser({ walletAddress, role }) {
    const mockEmail = `${walletAddress}@xaman.local`;
    const mockName = `Xaman User ${walletAddress.substring(0, 8)}`;
    const result = await query(
      `INSERT INTO users (email, name, role, wallet_address, auth_type)
       VALUES ($1, $2, $3, $4, 'xaman')
       RETURNING id, email, name, phone, role, wallet_address, kyc_status, created_at, auth_type, license_no, vehicle_type`,
      [mockEmail, mockName, role, walletAddress]
    );
    return result.rows[0];
  }

  static async createAdmin({ email, name, hashedPassword }) {
    const result = await query(
      `INSERT INTO users (email, name, password, role, auth_type)
       VALUES ($1, $2, $3, 'admin', 'jwt')
       RETURNING id, email, name, role, created_at`,
      [email, name, hashedPassword]
    );
    return result.rows[0];
  }

  // ============================================
  // UPDATE methods
  // ============================================

  static async updateProfile(id, { name, phone, profileImage, licenseNo, vehicleType }) {
    const result = await query(
      `UPDATE users
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           profile_image = COALESCE($3, profile_image),
           license_no = COALESCE($5, license_no),
           vehicle_type = COALESCE($6, vehicle_type),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, name, phone, role, wallet_address, profile_image, kyc_status, created_at, auth_type, license_no, vehicle_type`,
      [
        name !== undefined ? name : null, 
        phone !== undefined ? phone : null, 
        profileImage !== undefined ? profileImage : null, 
        id,
        licenseNo !== undefined ? licenseNo : null,
        vehicleType !== undefined ? vehicleType : null
      ]
    );
    return result.rows[0] || null;
  }

  // Used for admin password reset flow
  static async updatePassword(id, hashedPassword) {
    const result = await query(
      `UPDATE users
       SET password = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [hashedPassword, id]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // WALLET methods
  // ============================================

  // Only returns wallet_address (no seed — Xaman users manage their own keys)
  static async getWalletAddress(id) {
    const result = await query(
      'SELECT wallet_address FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0]?.wallet_address || null;
  }

  // ============================================
  // ADMIN methods
  // ============================================

  static async findAll(role = null) {
    let sql = `SELECT id, email, name, phone, role, wallet_address,
                      kyc_status, created_at, auth_type, license_no, vehicle_type FROM users`;
    const params = [];

    if (role) {
      sql += ' WHERE role = $1';
      params.push(role);
    }

    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  static async verifySeller(sellerId) {
    const result = await query(
      `UPDATE users
       SET kyc_status = 'APPROVED', updated_at = NOW()
       WHERE id = $1 AND role = 'seller'
       RETURNING id, email, name, role, kyc_status`,
      [sellerId]
    );
    return result.rows[0] || null;
  }

  static async findAdminByEmail(email) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND role = $2',
      [email, 'admin']
    );
    return result.rows[0] || null;
  }

  static async adminExists(email) {
    const result = await query(
      'SELECT id FROM users WHERE email = $1 AND role = $2',
      [email, 'admin']
    );
    return result.rows.length > 0;
  }
}

module.exports = User;