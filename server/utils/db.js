const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const config = require('../config/config');

let dbInstance = null;
let SQL = null;

/**
 * Get or initialize the in-memory SQLite database instance.
 * Automatically loads the database file if it exists, or creates the schema if not.
 * @returns {Promise<any>} The SQL.Database instance
 */
async function getDb() {
  if (dbInstance) return dbInstance;

  // Ensure the data directory exists
  fs.mkdirSync(config.DATA_DIR, { recursive: true });

  // Initialize WebAssembly engine
  SQL = await initSqlJs();

  if (fs.existsSync(config.DB_PATH)) {
    const fileBuffer = fs.readFileSync(config.DB_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
    
    // Create schema
    dbInstance.run(`
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        last_indexed TEXT NOT NULL
      );
    `);
    
    dbInstance.run(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        language TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        FOREIGN KEY (file_path) REFERENCES files(path) ON DELETE CASCADE
      );
    `);
    
    dbInstance.run(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    
    dbInstance.run("PRAGMA foreign_keys = ON;");
    save();
  }

  // Ensure foreign keys are enabled for the current connection
  dbInstance.run("PRAGMA foreign_keys = ON;");

  return dbInstance;
}

// Persist the in-memory database back to disk.
function save() {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(config.DB_PATH, buffer);
}

/**
 * Run a SQL statement (INSERT, UPDATE, DELETE).
 * @param {string} sql
 * @param {Array} params
 */
async function run(sql, params = []) {
  const db = await getDb();
  db.run(sql, params);
}

/**
 * Query and fetch multiple rows.
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<Array<object>>}
 */
async function all(sql, params = []) {
  const db = await getDb();
  const stmt = db.prepare(sql);
  
  if (params.length > 0) {
    stmt.bind(params);
  }
  
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Query and fetch a single row.
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<object|null>}
 */
async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] || null;
}

module.exports = {
  getDb,
  save,
  run,
  all,
  get
};
