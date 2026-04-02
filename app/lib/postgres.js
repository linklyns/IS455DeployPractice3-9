const { Pool } = require('pg');

let pool;

function getConnectionString() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set.');
  }

  return connectionString;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getConnectionString(),
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
      max: 5,
    });
  }

  return pool;
}

async function queryAll(query, parameters = []) {
  const result = await getPool().query(query, parameters);
  return result.rows;
}

async function queryOne(query, parameters = []) {
  const rows = await queryAll(query, parameters);
  return rows[0] || null;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  queryAll,
  queryOne,
  closePool,
};