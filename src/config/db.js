// src/config/db.js
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws'); // <-- 1. Import the new websocket package
require('dotenv').config();

// <-- 2. Tell Neon to use 'ws' to bypass the Windows Wi-Fi bug
neonConfig.webSocketConstructor = ws; 

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

const query = (text, params) => {
  return pool.query(text, params);
};

module.exports = { pool, query };