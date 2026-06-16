// src/app.js
const express = require('express');
const cors = require('cors');
const { query } = require('./config/db');

const app = express();

// ─────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────
const allowedOrigins = [
  'https://park-chain-k8rgfu13k-dhanas-projects-3283d047.vercel.app',
  'https://park-chain-web.vercel.app',
  'http://localhost:3000',
];

const corsOptions = {
  origin: function (origin, callback) {
    // allow server-to-server requests (curl, Postman, internal) with no origin
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // DON'T throw an Error — just reject cleanly
    // Throwing causes a 500; rejecting causes a 403
    console.warn('⚠️  CORS blocked origin:', origin);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

// Handle preflight for ALL routes FIRST, with same corsOptions
app.options('*', cors(corsOptions));

// Apply CORS to all routes
app.use(cors(corsOptions));

// ─────────────────────────────────────────────
// BODY PARSING
// ─────────────────────────────────────────────
app.use(express.json());

// ─────────────────────────────────────────────
// HEALTH ROUTES
// ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'ParkChain API',
    routes: {
      auth: '/api/auth',
      spots: '/api/spots',
      bookings: '/api/bookings',
      payments: '/api/payments',
      navigation: '/api/navigation',
      utils: '/api/utils',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
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
        rows: parseInt(countResult.rows[0].count),
      });
    }

    res.json({
      status: 'ok',
      databaseTime: timeResult.rows[0].current_time,
      tables: tableDetails,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// ─────────────────────────────────────────────
// ADMIN LOGIN
// ─────────────────────────────────────────────
app.post('/auth/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error('❌ ADMIN_EMAIL or ADMIN_PASSWORD not set in environment');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    if (email === adminEmail && password === adminPassword) {
      return res.json({
        success: true,
        message: 'Login successful',
        token: 'admin-jwt-token-placeholder',
        user: {
          email,
          role: 'admin',
        },
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
});

// ─────────────────────────────────────────────
// API ROUTES  (registered ONCE)
// ─────────────────────────────────────────────
app.use('/api/auth/xumm', require('./routes/XummRoutes'));
app.use('/api/auth', require('./routes/AuthRoutes'));
app.use('/api/users', require('./routes/UserRoutes'));
app.use('/api/spots', require('./routes/SpotRoutes'));
app.use('/api/bookings/check', require('./routes/BookingCheckRoutes'));
app.use('/api/bookings', require('./routes/BookingRoutes'));
app.use('/api/payments', require('./routes/PaymentRoutes'));
app.use('/api/navigation', require('./routes/NavigationRoutes'));
app.use('/api/notifications', require('./routes/NotificationRoutes'));
app.use('/api/reviews', require('./routes/ReviewRoutes'));
app.use('/api/utils', require('./routes/UtilsRoutes'));

// KYC / Didit
app.use('/api', require('./routes/KycRoutes'));
app.use('/api/kyb', require('./routes/KybRoutes'));

// Admin
app.use('/api/admin/kyb', require('./routes/AdminKybRoutes'));

// Seller
app.use('/api/seller/kyb', require('./routes/SellerKybRoutes'));

// ─────────────────────────────────────────────
// 404 HANDLER
// ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

module.exports = app;