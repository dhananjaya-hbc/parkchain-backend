// src/app.js
const express = require('express');
const cors = require('cors');
const { query } = require('./config/db');

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- ROUTES ---

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running!',
    timestamp: new Date().toISOString()
  });
});

app.get('/health/db', async (req, res) => {
  try {
    const timeResult = await query('SELECT NOW() as current_time');
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    const tableDetails = [];
    for (const row of tablesResult.rows) {
      const countResult = await query(`SELECT COUNT(*) as count FROM ${row.table_name}`);
      tableDetails.push({
        name: row.table_name,
        rows: parseInt(countResult.rows[0].count)
      });
    }

    res.json({
      status: 'ok',
      databaseTime: timeResult.rows[0].current_time,
      tables: tableDetails
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// AUTH ROUTES
app.use('/api/auth', require('./routes/AuthRoutes'));

app.get('/', (req, res) => {
  res.json({ message: 'Parking Payment API' });
});

// --- 404 HANDLER ---
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

module.exports = app;