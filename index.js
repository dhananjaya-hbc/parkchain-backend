// index.js
// This is the entry point of our application
// It does ONE thing: start the Express server

const app = require('./src/app');

// Read PORT from .env file, or use 5000 as default
require('dotenv').config();
const PORT = process.env.PORT || 3001;

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});