// src/config/db.js
// ============================================
// DATABASE CONNECTION
// ============================================
//
// What is a Connection Pool?
// --------------------------
// Imagine a restaurant with 10 phone lines.
// Instead of installing a new phone line for every customer call,
// you reuse the 10 lines. When a call ends, that line is free for the next customer.
//
// A connection pool works the same way:
// - It creates a few database connections at startup
// - When your code needs to query the database, it borrows a connection
// - When the query is done, the connection goes back to the pool
// - This is MUCH faster than creating a new connection every time
//
// Why Neon needs SSL?
// -------------------
// Neon is a cloud database. Data travels over the internet.
// SSL encrypts that data so nobody can read it in transit.
// That's why we set ssl: true

const { Pool } = require('pg');
require('dotenv').config();

// Create the connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false  // Required for Neon cloud database
  },
  max: 10,                     // Maximum 10 connections in the pool
  idleTimeoutMillis: 30000,    // Close unused connections after 30 seconds
  connectionTimeoutMillis: 10000  // Fail if can't connect in 10 seconds
});

// This function runs a SQL query
// Example: query('SELECT * FROM users WHERE id = $1', ['abc-123'])
//
// Why $1, $2, $3 instead of putting values directly in the SQL?
// -------------------------------------------------------------
// This prevents SQL INJECTION attacks.
// Bad:  query("SELECT * FROM users WHERE email = '" + email + "'")
//       Someone could send email = "'; DROP TABLE users; --"
// Good: query("SELECT * FROM users WHERE email = $1", [email])
//       The database treats $1 as a value, not as SQL code
const query = (text, params) => {
  return pool.query(text, params);
};

module.exports = { pool, query };