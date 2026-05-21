import dotenv from 'dotenv';
import knex from 'knex';

// Load environment variables from the .env file in the root directory
dotenv.config();

/**
 * Initialize Knex.js with PostgreSQL connection.
 * We are using DATABASE_URL by default. 
 * If you need to use the connection pooler in production, 
 * change this to process.env.PGBOUNCER_URL
 */
const db = knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Azure PostgreSQL
  },
  pool: {
    min: 2,
    max: 10,
    // Add additional pool configurations here if needed for stability
  },
});

export default db;
