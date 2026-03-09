// src/scripts/seedAdmin.js
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { pool } = require('../config/db');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    const name = process.env.ADMIN_NAME;

    if (!email || !password || !name) {
      console.error('❌ Missing admin credentials in .env file!');
      console.error('   Required: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME');
      process.exit(1);
    }

    console.log('🔄 Creating super admin account...\n');

    // Check if admin exists using User model
    const exists = await User.adminExists(email);

    if (exists) {
      console.log('ℹ️  Admin already exists. No changes made.');
      await pool.end();
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin using User model
    const admin = await User.createAdmin({ email, name, hashedPassword });

    console.log('✅ Super admin created successfully!\n');
    console.log(`   ID:    ${admin.id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name:  ${admin.name}`);
    console.log(`   Role:  ${admin.role}\n`);

  } catch (error) {
    console.error('❌ Failed to create admin:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
};

seedAdmin();