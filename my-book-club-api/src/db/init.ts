import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDb(): Promise<void> {
  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = await fs.readFile(schemaPath, "utf8");
  await pool.query(sql);
}
