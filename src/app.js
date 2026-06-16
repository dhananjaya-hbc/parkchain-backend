// src/app.js
const express = require('express');
const { query } = require('./config/db');

const app = express();

// ─────────────────────────────────────────────────────────
// CORS — ABSOLUTE FIRST, NO ERRORS POSSIBLE
// ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow all origins temporarily to fix the issue
  // You can restrict later after it works
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  // Handle preflight immediately
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

// ─────────────────────────────────────────────────────────
// BODY PARSING
// ─────────────────────────────────────────────────────────
app.use(express.json());

// ─────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'ParkChain API OK', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ─────────────────────────────────────────────────────────
// ADMIN LOGIN
// ─────────────────────────────────────────────────────────
app.post('/auth/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('[ADMIN LOGIN]', email);

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      return res.status(500).json({ success: false, message: 'Server config error' });
    }

    if (email === adminEmail && password === adminPassword) {
      return res.json({
        success: true,
        token: 'admin-jwt-token-placeholder',
        user: { email, role: 'admin' },
      });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────
app.get('/notifications', (req, res) => res.json({ success: true, notifications: [] }));

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
app.use('/api/kyb', require('./routes/KybRoutes'));
app.use('/api', require('./routes/KycRoutes'));
app.use('/api/admin/kyb', require('./routes/AdminKybRoutes'));
app.use('/api/seller/kyb', require('./routes/SellerKybRoutes'));

// ─────────────────────────────────────────────────────────
// 404
// ─────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.url}` });
});

module.exports = app;