const fs = require("node:fs");
const path = require("node:path");
let connection;
async function database() {
  if (connection) return connection;
  connection = (async () => {
    let query, close;
    if (process.env.DATABASE_URL) {
      const { Pool } = require("pg");
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 3,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
      });
      close = () => pool.end();
      query = async (sql, params = []) => {
        let i = 0;
        const r = await pool.query(
          sql.replace(/\?/g, () => "$" + ++i),
          params,
        );
        return r.rows;
      };
    } else {
      if (process.env.VERCEL || process.env.NODE_ENV === "production")
        throw new Error(
          "DATABASE_URL is required in production; local SQLite is development-only.",
        );
      const { DatabaseSync } = require("node:sqlite");
      const filename = process.env.SQLITE_PATH || path.join(__dirname, "../.data/store.sqlite");
      if (filename !== ":memory:") fs.mkdirSync(path.dirname(filename), { recursive: true });
      const db = new DatabaseSync(filename, { timeout: 5000 });
      db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
      close = () => db.close();
      query = async (sql, params = []) => db.prepare(sql).all(...params);
    }
    for (const sql of [
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,phone TEXT NOT NULL,address TEXT NOT NULL,password_hash TEXT NOT NULL,created BIGINT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires BIGINT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),receipt_hash TEXT,request_key TEXT NOT NULL UNIQUE,request_hash TEXT NOT NULL,status TEXT NOT NULL,total BIGINT NOT NULL,delivery TEXT NOT NULL,customer_json TEXT NOT NULL,items_json TEXT NOT NULL,created BIGINT NOT NULL)",
      "CREATE INDEX IF NOT EXISTS orders_owner_created ON orders(user_id,created)",
      "CREATE TABLE IF NOT EXISTS mixes (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,recipe_json TEXT NOT NULL,created BIGINT NOT NULL,updated BIGINT NOT NULL)",
      "CREATE INDEX IF NOT EXISTS mixes_owner_updated ON mixes(user_id,updated)",
      "CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT PRIMARY KEY,hits BIGINT NOT NULL,expires BIGINT NOT NULL)",
    ])
      await query(sql);
    return {
      query,
      async close() {
        await close();
        connection = null;
      },
    };
  })();
  try {
    return await connection;
  } catch (e) {
    connection = null;
    throw e;
  }
}
module.exports = { database };
