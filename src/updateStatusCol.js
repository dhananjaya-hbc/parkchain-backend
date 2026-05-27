const { query } = require('./config/db');

async function run() {
  try {
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';");
    console.log('Update successful');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();