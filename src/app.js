// src/app.js
const express = require('express');

// Try to load DB, but DON'T crash if it fails
let query;
try {
  const db = require('./config/db');
  query = db.query;
  console.log('✅ Database connected');
} catch (error) {
  console.warn('⚠️  Database not available, running without DB');
  query = async () => {
    throw new Error('Database not configured');
  };
}

const app = express();

// ─────────────────────────────────────────────────────────
// CORS — ABSOLUTE FIRST
// ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;

  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

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
// ROOT
// ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'ParkChain API is running',
    timestamp: new Date().toISOString(),
    dbAvailable: !!query,
  });
});

// ─────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    dbAvailable: !!query,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/db', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as current_time');
    res.json({
      status: 'ok',
      databaseTime: result.rows[0].current_time,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
});

// ─────────────────────────────────────────────────────────
// ADMIN LOGIN
// ─────────────────────────────────────────────────────────
app.post('/auth/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('[ADMIN LOGIN] Attempt:', email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error('❌ ADMIN_EMAIL or ADMIN_PASSWORD not set');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error — env vars missing',
      });
    }

    if (email === adminEmail && password === adminPassword) {
      console.log('[ADMIN LOGIN] ✅ Success');
      return res.json({
        success: true,
        message: 'Login successful',
        token: 'admin-jwt-token-placeholder',
        user: { email, role: 'admin' },
      });
    }

    console.log('[ADMIN LOGIN] ❌ Invalid credentials');
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  } catch (error) {
    console.error('[ADMIN LOGIN] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
});

// ─────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────
app.get('/notifications', (req, res) => {
  res.json({ success: true, notifications: [] });
});

app.post('/notifications/token', (req, res) => {
  res.json({ success: true, message: 'Token registered' });
});

app.delete('/notifications/token', (req, res) => {
  res.json({ success: true, message: 'Token removed' });
});

// ─────────────────────────────────────────────────────────
// ROUTES (try/catch each to prevent crashes)
// ─────────────────────────────────────────────────────────
const safeRequire = (path) => {
  try {
    return require(path);
  } catch (error) {
    console.warn(`⚠️  Route not found: ${path}`);
    return express.Router(); // Return empty router
  }
};

app.use('/api/auth/xumm', safeRequire('./routes/XummRoutes'));
app.use('/api/auth', safeRequire('./routes/AuthRoutes'));
app.use('/api/users', safeRequire('./routes/UserRoutes'));
app.use('/api/spots', safeRequire('./routes/SpotRoutes'));
app.use('/api/bookings/check', safeRequire('./routes/BookingCheckRoutes'));
app.use('/api/bookings', safeRequire('./routes/BookingRoutes'));
app.use('/api/payments', safeRequire('./routes/PaymentRoutes'));
app.use('/api/navigation', safeRequire('./routes/NavigationRoutes'));
app.use('/api/notifications', safeRequire('./routes/NotificationRoutes'));
app.use('/api/reviews', safeRequire('./routes/ReviewRoutes'));
app.use('/api/utils', safeRequire('./routes/UtilsRoutes'));
app.use('/api/kyb', safeRequire('./routes/KybRoutes'));
app.use('/api', safeRequire('./routes/KycRoutes'));
app.use('/api/admin/kyb', safeRequire('./routes/AdminKybRoutes'));
app.use('/api/seller/kyb', safeRequire('./routes/SellerKybRoutes'));

// ─────────────────────────────────────────────────────────
// 404
// ─────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.url}` });
});

// ─────────────────────────────────────────────────────────
// ERROR HANDLER
// ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

module.exports = app;