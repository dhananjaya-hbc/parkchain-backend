// src/app.js
// This file creates and configures the Express application
// Think of Express as a "web server framework" - it handles HTTP requests

const express = require('express');
const cors = require('cors');

// Create the Express application
const app = express();

// --- MIDDLEWARE ---
// Middleware = functions that run on EVERY request before your route handlers

// cors() allows requests from other domains (your Flutter app, Next.js app)
// Without this, browsers block requests from different origins
app.use(cors());

// express.json() parses incoming JSON request bodies
// Without this, req.body would be undefined when someone sends JSON
app.use(express.json());

// --- ROUTES ---

// Health check route - used to verify the server is running
// When you visit http://localhost:5000/health, you'll see this response
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running!',
    timestamp: new Date().toISOString()
  });
});

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Parking Payment API' });
});

// --- ERROR HANDLING ---

// This catches any request to a route that doesn't exist
// It MUST be after all your routes
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

module.exports = app;