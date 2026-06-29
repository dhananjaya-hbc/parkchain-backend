// index.js
// Entry point: connects to database, then starts the server

const app = require('./src/app');
const { pool } = require('./src/config/db');
const initUnblockCron = require('./src/cron/unblockCron');
require('dotenv').config();

const PORT = process.env.PORT || 3001;

// We use an async function because database queries are asynchronous
// (they take time to travel to the cloud and back)
const startServer = async () => {
  try {
    // Test the database connection by asking PostgreSQL for the current time
    const result = await pool.query('SELECT NOW()');

    // If we reach this line, the connection worked!
    console.log('Database connected successfully!');
    console.log('Database time:', result.rows[0].now);

    // Initialize cron jobs
    initUnblockCron();

    // Now start the Express server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

  } catch (error) {
    // If database connection fails, show the error and stop
    console.error('Database connection failed!');
    console.error('Error:', error.message);
    console.error('');
    console.error('Check these things:');
    console.error('1. Is DATABASE_URL correct in your .env file?');
    console.error('2. Is your Neon project active?');
    console.error('3. Is your IP allowed in Neon settings?');
    process.exit(1);  // Stop the program with error code 1
  }
};

startServer();