import dotenv from 'dotenv';
import app from './src/app.js';
import './src/config/db.js';
dotenv.config({ path: '.env.example' });
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
