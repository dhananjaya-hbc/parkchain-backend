// src/app.js
const express = require('express');
const cors = require('cors');
const { query } = require('./config/db');

const app = express();

// ─────────────────────────────────────────────────────────
// 1. CORS — must be FIRST, before everything else
// ─────────────────────────────────────────────────────────
const allowedOrigins = [
  'https://park-chain-web.vercel.app',
  'https://park-chain-k8rgfu13k-dhanas-projects-3283d047.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  console.log(`[CORS] ${req.method} ${req.url} — origin: ${origin || 'none'}`);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  // ✅ Handle preflight immediately — no other middleware runs
  if (req.method === 'OPTIONS') {
    console.log(`[CORS] Preflight handled for origin: ${origin}`);
    return res.status(204).end();
  }

  next();
});

// ─────────────────────────────────────────────────────────
// 2. BODY PARSING
// ─────────────────────────────────────────────────────────
app.use(express.json());

// ─────────────────────────────────────────────────────────
// 3. HEALTH CHECKS
// ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'ParkChain API is running ✅' });
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
        `SELECT COUNT(*) as count FROM "${row.table_name}"`
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
    console.error('DB health check error:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────
// 4. ADMIN LOGIN  (at /auth/admin/login)
// ─────────────────────────────────────────────────────────
app.post('/auth/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const adminEmail    = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error('❌ ADMIN_EMAIL or ADMIN_PASSWORD not set');
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
        user: { email, role: 'admin' },
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

// ─────────────────────────────────────────────────────────
// 5. NOTIFICATIONS  (at /notifications)
// ─────────────────────────────────────────────────────────
app.get('/notifications', (req, res) => {
  res.json({ success: true, notifications: [] });
});

// ─────────────────────────────────────────────────────────
// 6. API ROUTES  — registered ONCE, correct order
// ─────────────────────────────────────────────────────────

// xumm MUST come before /api/auth (more specific first)
app.use('/api/auth/xumm',      require('./routes/XummRoutes'));
app.use('/api/auth',           require('./routes/AuthRoutes'));

app.use('/api/users',          require('./routes/UserRoutes'));
app.use('/api/spots',          require('./routes/SpotRoutes'));

// check MUST come before /api/bookings (more specific first)
app.use('/api/bookings/check', require('./routes/BookingCheckRoutes'));
app.use('/api/bookings',       require('./routes/BookingRoutes'));

app.use('/api/payments',       require('./routes/PaymentRoutes'));
app.use('/api/navigation',     require('./routes/NavigationRoutes'));
app.use('/api/notifications',  require('./routes/NotificationRoutes'));
app.use('/api/reviews',        require('./routes/ReviewRoutes'));
app.use('/api/utils',          require('./routes/UtilsRoutes'));

// KYC / Didit webhooks
app.use('/api/kyb',            require('./routes/KybRoutes'));
app.use('/api',                require('./routes/KycRoutes'));

// Admin
app.use('/api/admin/kyb',      require('./routes/AdminKybRoutes'));

// Seller
app.use('/api/seller/kyb',     require('./routes/SellerKybRoutes'));

// ─────────────────────────────────────────────────────────
// 7. 404 HANDLER
// ─────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

module.exports = app;