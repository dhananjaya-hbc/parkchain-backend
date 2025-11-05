import pkg from 'pg';
import secrets from '../../secrets.js';

const { Pool } = pkg;

let pool;

if (secrets.databaseUrl) {
  // Create a real pool only when DATABASE_URL is configured
  pool = new Pool({
    connectionString: secrets.databaseUrl,
    ssl: secrets.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
  });

  pool.connect()
    .then(() => console.log('✅ Connected to PostgreSQL'))
    .catch(err => console.error('❌ DB connection error:', err && err.message ? err.message : err));
} else {
  // Avoid passing undefined to pg-connection-string.parse which causes the TypeError
  console.warn('⚠️  DATABASE_URL is not set — DB pool will not be created. Set DATABASE_URL in your .env to enable DB connection.');
  // Provide a minimal stub so other modules can still import `pool` without crashing.
  pool = {
    query: async () => { throw new Error('DATABASE_URL not configured'); },
    connect: async () => { throw new Error('DATABASE_URL not configured'); },
  };
}

export { pool };
