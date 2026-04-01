// src/models/User.js
// ============================================
// USER MODEL
// ============================================
// Single model for ALL user types (driver, seller, admin)
// All users live in the same 'users' table, differentiated by 'role'
//
// Why ONE model instead of 4 (Admin, Driver, Owner, BaseUser)?
// ─────────────────────────────────────────────────────────────
// Our users table is ONE table with a 'role' column.
// Separate model files would just add complexity without benefit.
// We use the 'role' column to determine permissions (in middleware).

const { query } = require('../config/db');

class User {
  // ============================================
  // FIND methods
  // ============================================

  // Find user by ID (used by AuthMiddleware)
  static async findById(id) {
    const result = await query(
      `SELECT id, email, name, phone, role, wallet_address,
              web3auth_sub, profile_image, is_verified, created_at, auth_type
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // Find user by email
  static async findByEmail(email) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  // Find user by wallet address (used for Xaman login)
  static async findByWalletAddress(walletAddress) {
    const result = await query(
      'SELECT * FROM users WHERE wallet_address = $1',
      [walletAddress]
    );
    return result.rows[0] || null;
  }

  // Find user by Web3Auth subject ID
  static async findByWeb3AuthSub(sub) {
    const result = await query(
      `SELECT id, email, name, phone, role, wallet_address,
              web3auth_sub, profile_image, is_verified, created_at, auth_type
       FROM users WHERE web3auth_sub = $1`,
      [sub]
    );
    return result.rows[0] || null;
  }

  // Find by web3auth_sub OR email (used during Web3Auth login)
  static async findByWeb3AuthOrEmail(web3authSub, email) {
    const result = await query(
      `SELECT * FROM users 
       WHERE web3auth_sub = $1 OR email = $2`,
      [web3authSub, email]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // CREATE methods
  // ============================================

  // Create driver or seller (via Web3Auth — NO password)
  static async createWeb3AuthUser({ email, name, role, walletAddress, web3authSub, profileImage }) {
    const result = await query(
      `INSERT INTO users (email, name, role, wallet_address, web3auth_sub, profile_image, auth_type)
       VALUES ($1, $2, $3, $4, $5, $6, 'web3auth')
       RETURNING id, email, name, phone, role, wallet_address, web3auth_sub, profile_image, is_verified, created_at, auth_type`,
      [email, name, role, walletAddress || null, web3authSub, profileImage]
    );
    return result.rows[0];
  }

  // Create driver or seller (via Xaman Wallet)
  static async createXamanUser({ walletAddress, role }) {
    // Generate a placeholder email/name for Xaman users (since they don't provide one natively)
    const mockEmail = `${walletAddress}@xaman.local`;
    const mockName = `Xaman User ${walletAddress.substring(0, 5)}`;
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
      `INSERT INTO users (email, name, password, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, email, name, role, created_at`,
      [email, name, hashedPassword]
    );
    return result.rows[0];
  }

  // ============================================
  // UPDATE methods
  // ============================================

  static async updateWeb3AuthInfo(id, { name, walletAddress, profileImage, web3authSub }) {
    const result = await query(
      `UPDATE users
     SET name = $1,
         profile_image = COALESCE($2, profile_image),
         web3auth_sub = $3,
         wallet_address = CASE
           WHEN $4::text IS NOT NULL AND $4::text LIKE 'r%' THEN $4::text
           WHEN wallet_address IS NOT NULL AND wallet_address LIKE 'r%' THEN wallet_address
           ELSE COALESCE(NULLIF($4::text, ''), wallet_address)
         END,
         wallet_seed = CASE
           WHEN $4::text IS NOT NULL AND $4::text LIKE 'r%' AND wallet_address != $4::text THEN NULL
           ELSE wallet_seed
         END,
         updated_at = NOW()
     WHERE id = $5
     RETURNING id, email, name, phone, role, wallet_address, web3auth_sub, profile_image, is_verified, created_at`,
      [name, profileImage, web3authSub, walletAddress, id]
    );
    return result.rows[0] || null;
  }
  // Update wallet info (when generating XRPL wallet)
  static async updateWallet(id, walletAddress, walletSeed) {
    const result = await query(
      `UPDATE users
       SET wallet_address = $1, wallet_seed = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, name, role, wallet_address`, [walletAddress, walletSeed, id]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // WALLET methods
  // ============================================

  // Get wallet details (including seed — for backend payment use only)
  static async getWalletDetails(id) {
    const result = await query(
      'SELECT wallet_address, wallet_seed FROM users WHERE id = $1', [id]
    );
    return result.rows[0] || null;
  }

  // ============================================
  // ADMIN methods
  // ============================================

  // Get all users (admin view)
  static async findAll(role = null) {
    let sql = `SELECT id, email, name, phone, role, wallet_address,
                      is_verified, created_at FROM users`;
    const params = [];

    if (role) {
      sql += ' WHERE role = $1';
      params.push(role);
    }

    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  // Verify seller (admin action)
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

  // Find admin by email (for admin login)
  static async findAdminByEmail(email) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND role = $2',
      [email, 'admin']
    );
    return result.rows[0] || null;
  }

  // Check if admin exists (for seed script)
  static async adminExists(email) {
    const result = await query(
      'SELECT id FROM users WHERE email = $1 AND role = $2',
      [email, 'admin']
    );
    return result.rows.length > 0;
  }
}

module.exports = User;