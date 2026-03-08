// src/scripts/seedAdmin.js
// ============================================
// SEED SUPER ADMIN ACCOUNT
// ============================================
// Run this ONCE to create the admin account in the database
// Usage: npm run seed:admin
//
// Why a separate script?
// We can't put the admin INSERT in schema.sql because
// the password needs to be hashed using bcrypt (JavaScript),
// and SQL can't run JavaScript.

const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME;

    // Validate env variables exist
    if (!email || !password || !name) {
      console.error('❌ Missing admin credentials in .env file!');
      console.error('   Required: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME');
      process.exit(1);
    }

    console.log('🔄 Creating super admin account...\n');

    // Check if admin already exists
    const existing = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      console.log('ℹ️  Admin already exists:');
      console.log(`   Email: ${existing.rows[0].email}`);
      console.log(`   ID: ${existing.rows[0].id}`);
      console.log('\n   No changes made. To reset, delete the user from Neon first.');
      await pool.end();
      process.exit(0);
    }

    // Hash the password
    // bcrypt.genSalt(10) = generate a random salt with 10 rounds
    // More rounds = more secure but slower
    // 10 is the standard recommendation
    //
    // What is a salt?
    // Without salt: "password123" always hashes to the same value
    //   → Hackers can use pre-computed tables (rainbow tables) to crack it
    // With salt: "password123" + random salt = unique hash every time
    //   → Much harder to crack
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert admin into database
    const result = await pool.query(
      `INSERT INTO users (email, password, name, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, email, name, role, created_at`,
      [email, hashedPassword, name]
    );

    const admin = result.rows[0];

    console.log('✅ Super admin created successfully!\n');
    console.log('   Admin Details:');
    console.log('   ─'.padEnd(40, '─'));
    console.log(`   ID:    ${admin.id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name:  ${admin.name}`);
    console.log(`   Role:  ${admin.role}`);
    console.log('   ─'.padEnd(40, '─'));
    console.log(`\n   Login at: POST /api/auth/admin/login`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: (as set in .env)\n`);

  } catch (error) {
    console.error('❌ Failed to create admin:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
};

seedAdmin();