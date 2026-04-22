const { query } = require('../config/db');

const addLicenseNoColumn = async () => {
  try {
    console.log('Adding license_no column to users table...');
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS license_no VARCHAR(255);
    `);
    console.log('Successfully added license_no column!');
  } catch (error) {
    console.error('Error adding column:', error.message);
  } finally {
    process.exit(0);
  }
};

addLicenseNoColumn();
