import dotenv from 'dotenv';
dotenv.config({ path: './.env.example' });

const secrets = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
    nodeEnv: process.env.NODE_ENV,
};

export default secrets;
