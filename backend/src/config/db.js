const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { Pool } = require('pg');
require('dotenv').config();

let dbMode = 'sqlite';
let pgPool = null;
let sqliteDb = null;
let sqliteFile = path.resolve(__dirname, '../../data/nitte_bus.sqlite');

// Ensure data directory exists
const dataDir = path.dirname(sqliteFile);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let isInitialized = false;

function saveSqliteToFile() {
  if (dbMode === 'sqlite' && sqliteDb) {
    try {
      const data = sqliteDb.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(sqliteFile, buffer);
    } catch (err) {
      console.error('[DB] Error saving SQLite to file:', err.message);
    }
  }
}

async function initDB() {
  if (isInitialized) return;

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
    console.log('[DB] Connecting to PostgreSQL database...');
    pgPool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    dbMode = 'postgres';
    console.log('[DB] PostgreSQL connected successfully.');
  } else {
    console.log('[DB] Using SQLite (sql.js WASM) engine with file persistence at:', sqliteFile);
    const SQL = await initSqlJs();
    if (fs.existsSync(sqliteFile)) {
      const fileBuffer = fs.readFileSync(sqliteFile);
      sqliteDb = new SQL.Database(fileBuffer);
      console.log('[DB] Loaded existing SQLite database file.');
    } else {
      sqliteDb = new SQL.Database();
      console.log('[DB] Created new SQLite in-memory database.');
    }
    dbMode = 'sqlite';
  }

  // Load and apply schema
  const schemaPath = path.resolve(__dirname, '../db/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await executeRaw(schemaSql);
    if (dbMode === 'sqlite') {
      saveSqliteToFile();
    }
    console.log('[DB] Database schema verified & applied.');
  }

  isInitialized = true;
}

// Convert $1, $2 (Postgres style) or ? (SQLite style) as appropriate
function formatParams(sql, params = []) {
  if (dbMode === 'postgres') {
    // If SQL uses ? placeholders, convert to $1, $2, etc.
    let paramIndex = 1;
    const convertedSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    return { sql: convertedSql, params };
  } else {
    // SQLite: sql.js supports array params with ? placeholders
    // If SQL uses $1, $2, convert to ? placeholders
    const convertedSql = sql.replace(/\$\d+/g, '?');
    return { sql: convertedSql, params };
  }
}

async function executeRaw(rawSql) {
  if (dbMode === 'postgres') {
    return await pgPool.query(rawSql);
  } else {
    sqliteDb.run(rawSql);
    saveSqliteToFile();
    return true;
  }
}

async function query(sql, params = []) {
  if (!isInitialized) await initDB();

  const formatted = formatParams(sql, params);

  if (dbMode === 'postgres') {
    const res = await pgPool.query(formatted.sql, formatted.params);
    return {
      rows: res.rows,
      rowCount: res.rowCount
    };
  } else {
    // sql.js query
    const isSelect = /^\s*(SELECT|PRAGMA|WITH)/i.test(formatted.sql);
    if (isSelect) {
      const stmt = sqliteDb.prepare(formatted.sql);
      if (formatted.params && formatted.params.length > 0) {
        stmt.bind(formatted.params);
      }
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return { rows, rowCount: rows.length };
    } else {
      // Execute INSERT, UPDATE, DELETE
      sqliteDb.run(formatted.sql, formatted.params);
      saveSqliteToFile();
      const changesRes = sqliteDb.exec("SELECT changes() AS changes;");
      const changes = (changesRes[0] && changesRes[0].values[0][0]) || 0;
      return { rows: [], rowCount: changes };
    }
  }
}

async function get(sql, params = []) {
  const result = await query(sql, params);
  return result.rows && result.rows.length > 0 ? result.rows[0] : null;
}

async function all(sql, params = []) {
  const result = await query(sql, params);
  return result.rows || [];
}

async function run(sql, params = []) {
  return await query(sql, params);
}

module.exports = {
  initDB,
  query,
  get,
  all,
  run,
  executeRaw,
  getDbMode: () => dbMode,
  saveSqliteToFile
};
