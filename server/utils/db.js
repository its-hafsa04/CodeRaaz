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
  }

  // Create new tables and migrate old ones if needed
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      repo_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
    );
  `);

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );
  `);

  // Check that both index tables use the current repository-aware schema.
  let needMigration = false;
  try {
    const requiredColumns = {
      files: ['repo_id', 'path', 'hash', 'last_indexed'],
      chunks: ['id', 'repo_id', 'file_path', 'file_name', 'language', 'start_line', 'end_line', 'content', 'embedding']
    };

    for (const [tableName, columns] of Object.entries(requiredColumns)) {
      const tableInfo = dbInstance.exec(`PRAGMA table_info(${tableName})`);
      const existingColumns = tableInfo[0]?.values?.map(column => column[1]) || [];
      if (!columns.every(column => existingColumns.includes(column))) {
        needMigration = true;
        break;
      }
    }
  } catch (err) {
    needMigration = true;
  }

  if (needMigration) {
    dbInstance.run("DROP TABLE IF EXISTS chunks;");
    dbInstance.run("DROP TABLE IF EXISTS files;");

    dbInstance.run(`
      CREATE TABLE files (
        repo_id TEXT NOT NULL,
        path TEXT NOT NULL,
        hash TEXT NOT NULL,
        last_indexed TEXT NOT NULL,
        PRIMARY KEY (repo_id, path),
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
      );
    `);
    
    dbInstance.run(`
      CREATE TABLE chunks (
        id TEXT PRIMARY KEY,
        repo_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        language TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        FOREIGN KEY (repo_id, file_path) REFERENCES files(repo_id, path) ON DELETE CASCADE,
        FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
      );
    `);
  }

  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  
  // Ensure foreign keys are enabled
  dbInstance.run("PRAGMA foreign_keys = ON;");
  
  if (!fs.existsSync(config.DB_PATH) || needMigration) {
    save();
  }

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
