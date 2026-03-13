import "../config/env.js";
import { initDb } from "../db/init.js";
import { pool } from "../db/pool.js";

try {
  await initDb();
  console.log("Database schema initialized.");
} finally {
  await pool.end();
}
