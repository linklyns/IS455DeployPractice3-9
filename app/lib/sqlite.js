const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js/dist/sql-asm.js');

let sqlModulePromise;

function getDatabasePath() {
  return process.env.SHOP_DB_PATH || path.join(process.cwd(), '..', 'shop.db');
}

function getFeedbackTableSql() {
  return `
    CREATE TABLE IF NOT EXISTS fraud_feedback (
      feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE,
      feedback_label TEXT NOT NULL CHECK (feedback_label IN ('fraud', 'not_fraud')),
      review_notes TEXT,
      reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

function getSqlModule() {
  if (!sqlModulePromise) {
    sqlModulePromise = initSqlJs();
  }

  return sqlModulePromise;
}

async function openDatabase() {
  const SQL = await getSqlModule();
  const databasePath = getDatabasePath();

  if (!fs.existsSync(databasePath)) {
    throw new Error(`Database file not found at ${databasePath}`);
  }

  const bytes = fs.readFileSync(databasePath);
  const database = new SQL.Database(bytes);
  database.run(getFeedbackTableSql());

  return { database, databasePath };
}

function persistDatabase(database, databasePath) {
  const data = database.export();
  fs.writeFileSync(databasePath, Buffer.from(data));
}

function queryAll(database, query, parameters = []) {
  const statement = database.prepare(query);

  try {
    statement.bind(parameters);

    const rows = [];

    while (statement.step()) {
      rows.push(statement.getAsObject());
    }

    return rows;
  } finally {
    statement.free();
  }
}

function queryOne(database, query, parameters = []) {
  const rows = queryAll(database, query, parameters);
  return rows[0] || null;
}

module.exports = {
  getDatabasePath,
  openDatabase,
  persistDatabase,
  queryAll,
  queryOne,
};