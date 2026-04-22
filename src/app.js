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
      const countResult = await query(
        `SELECT COUNT(*) as count FROM ${row.table_name}`
      );
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

// API Routes
app.use('/api/auth', require('./routes/AuthRoutes'));
app.use('/api/users', require('./routes/UserRoutes'));
app.use('/api/auth/xumm', require('./routes/XummRoutes')); 
app.use('/api/spots', require('./routes/SpotRoutes'));
app.use('/api/bookings', require('./routes/BookingRoutes'));
app.use('/api/payments', require('./routes/PaymentRoutes'));
app.use('/api/navigation', require('./routes/NavigationRoutes'));

// KYC / Didit Webhooks Routes
app.use('/api', require('./routes/KycRoutes'));
app.use('/api/kyb', require('./routes/KybRoutes'));

// Admin Dashboard Routes
app.use('/api/admin/kyb', require('./routes/AdminKybRoutes'));

// Seller Dashboard Routes
app.use('/api/seller/kyb', require('./routes/SellerKybRoutes'));

app.get('/', (req, res) => {
  res.json({
    message: 'Parking Payment API',
    routes: {
      auth: '/api/auth',
      spots: '/api/spots',
      bookings: '/api/bookings',
      payments: '/api/payments',
      navigation: '/api/navigation'
    }
  });
});

// --- 404 HANDLER ---
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

module.exports = app;