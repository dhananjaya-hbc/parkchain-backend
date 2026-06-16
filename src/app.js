// src/app.js
const express = require('express');
const { query } = require('./config/db');

const app = express();

// ─────────────────────────────────────────────────────────
// 1. CORS — FIRST MIDDLEWARE
// ─────────────────────────────────────────────────────────
const allowedOrigins = [
  'https://park-chain-web.vercel.app',
  'https://park-chain-k8rgfu13k-dhanas-projects-3283d047.vercel.app',
  // ⚠️ ADD YOUR ACTUAL FRONTEND URL BELOW:
  // 'https://your-frontend-domain.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  console.log(`[CORS] ${req.method} ${req.url} — origin: ${origin || 'none'}`);

  // Always set CORS headers for known origins
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');

  // Handle preflight immediately
  if (req.method === 'OPTIONS') {
    console.log(`[CORS] Returning 204 for preflight`);
    return res.status(204).end();
  }

  next();
});

// ─────────────────────────────────────────────────────────
// 2. BODY PARSING
// ─────────────────────────────────────────────────────────
app.use(express.json());

// ─────────────────────────────────────────────────────────
// 3. ROOT / HEALTH
// ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'ParkChain API is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────
// 4. ADMIN LOGIN — with /api prefix to match frontend
// ─────────────────────────────────────────────────────────
app.post('/api/auth/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log(`[ADMIN LOGIN] Attempt: ${email}`);

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
        message: 'Server configuration error',
      });
    }

    if (email === adminEmail && password === adminPassword) {
      console.log(`[ADMIN LOGIN] ✅ Success for ${email}`);
      return res.json({
        success: true,
        message: 'Login successful',
        token: 'admin-jwt-token-placeholder',
        user: { email, role: 'admin' },
      });
    }

    console.log(`[ADMIN LOGIN] ❌ Invalid credentials for ${email}`);
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
// 5. NOTIFICATIONS
// ─────────────────────────────────────────────────────────
app.get('/api/notifications', (req, res) => {
  res.json({ success: true, notifications: [] });
});

app.post('/api/notifications/token', async (req, res) => {
  const { fcm_token } = req.body;
  if (!fcm_token) {
    return res.status(400).json({ success: false, message: 'fcm_token required' });
  }
  console.log('FCM Token registered:', fcm_token);
  res.json({ success: true, message: 'Token registered' });
});

app.delete('/api/notifications/token', async (req, res) => {
  const { fcm_token } = req.body;
  if (!fcm_token) {
    return res.status(400).json({ success: false, message: 'fcm_token required' });
  }
  console.log('FCM Token removed:', fcm_token);
  res.json({ success: true, message: 'Token removed' });
});

// ─────────────────────────────────────────────────────────
// 6. API ROUTES (registered ONCE)
// ─────────────────────────────────────────────────────────
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
// 7. 404 HANDLER
// ─────────────────────────────────────────────────────────
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.url}`);
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

module.exports = app;