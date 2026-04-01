// src/models/User.js
const { query } = require('../config/db');

class User {
  // ============================================
  // FIND methods
  // ============================================

  static async findById(id) {
    const result = await query(
      `SELECT id, email, name, phone, role, wallet_address,
              profile_image, is_verified, created_at, auth_type
       FROM users WHERE id = $1`,
      [id]
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

  // Create driver or seller via Xaman Wallet
  static async createXamanUser({ walletAddress, role }) {
    const mockEmail = `${walletAddress}@xaman.local`;
    const mockName = `Xaman User ${walletAddress.substring(0, 8)}`;
    const result = await query(
      `INSERT INTO users (email, name, role, wallet_address, auth_type)
       VALUES ($1, $2, $3, $4, 'xaman')
       RETURNING id, email, name, phone, role, wallet_address, is_verified, created_at, auth_type`,
      [mockEmail, mockName, role, walletAddress]
    );
    return result.rows[0];
  }

  // Create admin (with password)
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

  // Update user profile info
  static async updateProfile(id, { name, phone, profileImage }) {
    const result = await query(
      `UPDATE users
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           profile_image = COALESCE($3, profile_image),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, name, phone, role, wallet_address, profile_image, is_verified, created_at, auth_type`,
      [name, phone, profileImage, id]
    );
    return result.rows[0] || null;
  }

  // Update wallet info (only used internally if needed)
  static async updateWallet(id, walletAddress, walletSeed) {
    const result = await query(
      `UPDATE users
       SET wallet_address = $1, wallet_seed = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, name, role, wallet_address`,
      [walletAddress, walletSeed, id]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // WALLET methods
  // ============================================

  static async getWalletDetails(id) {
    const result = await query(
      'SELECT wallet_address, wallet_seed FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // ADMIN methods
  // ============================================

  static async findAll(role = null) {
    let sql = `SELECT id, email, name, phone, role, wallet_address,
                      is_verified, created_at, auth_type FROM users`;
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
       SET is_verified = true, updated_at = NOW()
       WHERE id = $1 AND role = 'seller'
       RETURNING id, email, name, role, is_verified`,
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