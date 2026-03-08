// src/app.js
const express = require('express');
const cors = require('cors');
const { query } = require('./config/db');

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- ROUTES ---

// Basic health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running!',
    timestamp: new Date().toISOString()
  });
});

// Database health check
// This route tests if the database is working
app.get('/health/db', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as current_time');
    res.json({
      status: 'ok',
      message: 'Database is connected!',
      databaseTime: result.rows[0].current_time
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed!',
      error: error.message
    });
  }
});

// Home route
app.get('/', (req, res) => {
  res.json({ message: 'Parking Payment API' });
});

// --- 404 HANDLER ---
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

module.exports = app;