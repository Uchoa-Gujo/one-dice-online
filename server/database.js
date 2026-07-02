const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 20),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 8000),
  statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 18000),
  query_timeout: Number(process.env.PG_QUERY_TIMEOUT_MS || 18000),
  keepAlive: true,
  allowExitOnIdle: false,
  application_name: process.env.PG_APP_NAME || 'one-dice-online',
});

pool.on('error', error => {
  console.error('PostgreSQL pool error:', error);
});

async function query(text, params) {
  const start = Date.now();
  try {
    return await pool.query(text, params);
  } catch (error) {
    const compact = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    console.error('PostgreSQL query failed:', compact, error.message || error);
    throw error;
  } finally {
    const ms = Date.now() - start;
    if (ms > Number(process.env.PG_SLOW_QUERY_MS || 900)) {
      const compact = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 220);
      console.warn(`PostgreSQL slow query ${ms}ms: ${compact}`);
    }
  }
}

module.exports = { pool, query };
