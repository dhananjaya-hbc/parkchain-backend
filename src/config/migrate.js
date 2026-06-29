// src/config/migrate.js
// ============================================
// DATABASE MIGRATION SCRIPT
// ============================================
// Reads schema.sql and executes it against Neon PostgreSQL
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const migrate = async () => {
  try {
    console.log('🔄 Starting database migration...\n');

    // Read the SQL file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('📄 Schema file loaded, executing SQL...\n');

    // Execute all the SQL
    await pool.query(schema);

    // Backfill schema changes for existing databases
    await pool.query(`
      ALTER TABLE spots
      ADD COLUMN IF NOT EXISTS kyb_submission_id UUID UNIQUE REFERENCES kyb_submissions(id) ON DELETE CASCADE;
    `);

    await pool.query(`
      ALTER TABLE spots
      ADD COLUMN IF NOT EXISTS slots_per_type INTEGER[] DEFAULT ARRAY[1];
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50);
    `);

    await pool.query(`
      ALTER TABLE spots
      ALTER COLUMN is_approved SET DEFAULT true;
    `);

    await pool.query(`
      ALTER TABLE spots
      DROP COLUMN IF EXISTS amenities;
    `);

    await pool.query(`
      ALTER TABLE spots
      DROP COLUMN IF EXISTS blocked;
    `);

    await pool.query(`
      ALTER TABLE spots
      DROP COLUMN IF EXISTS is_blocked;
    `);

    await pool.query(`
      ALTER TABLE spots
      ADD COLUMN IF NOT EXISTS is_blocked_by_seller BOOLEAN DEFAULT false;
    `);

    await pool.query(`
      ALTER TABLE spots
      ADD COLUMN IF NOT EXISTS block_start_time TIMESTAMP WITH TIME ZONE;
    `);

    await pool.query(`
      ALTER TABLE spots
      ADD COLUMN IF NOT EXISTS block_end_time TIMESTAMP WITH TIME ZONE;
    `);

    await pool.query(`
      ALTER TABLE spots
      ADD COLUMN IF NOT EXISTS block_reason TEXT;
    `);

    console.log('✅ All tables created successfully!\n');

    // Verify: list all tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('📋 Tables in your database:');
    console.log('─'.repeat(30));
    tablesResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });
    console.log('─'.repeat(30));

    // Show columns for the bookings table (to verify our new fields)
    const bookingColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'bookings'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Bookings table columns:');
    console.log('─'.repeat(60));
    bookingColumns.rows.forEach((col) => {
      const nullable = col.is_nullable === 'YES' ? 'optional' : 'required';
      console.log(`   ${col.column_name.padEnd(28)} ${col.data_type.padEnd(20)} ${nullable}`);
    });
    console.log('─'.repeat(60));

    // Show columns for users table (to verify Web3Auth fields)
    const userColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Users table columns:');
    console.log('─'.repeat(60));
    userColumns.rows.forEach((col) => {
      const nullable = col.is_nullable === 'YES' ? 'optional' : 'required';
      console.log(`   ${col.column_name.padEnd(28)} ${col.data_type.padEnd(20)} ${nullable}`);
    });
    console.log('─'.repeat(60));

    console.log('\n🎉 Migration completed! Database is ready.\n');

  } catch (error) {
    console.error('❌ Migration failed!\n');
    console.error('Error:', error.message);

    if (error.message.includes('already exists')) {
      console.error('\n💡 Tables already exist. This is normal if you run migrate again.');
      console.error('   If you want to start fresh, drop all tables first in Neon console.');
    }
  } finally {
    await pool.end();
    process.exit(0);
  }
};

migrate();