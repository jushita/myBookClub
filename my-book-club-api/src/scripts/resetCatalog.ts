import "../config/env.js";
import { pool } from "../db/pool.js";

async function main() {
  await pool.query("BEGIN");

  try {
    await pool.query("TRUNCATE TABLE recommendation_cache RESTART IDENTITY");
    await pool.query("TRUNCATE TABLE club_discussion_questions RESTART IDENTITY CASCADE");
    await pool.query("TRUNCATE TABLE club_books RESTART IDENTITY CASCADE");
    await pool.query("TRUNCATE TABLE books RESTART IDENTITY CASCADE");
    await pool.query("COMMIT");
    console.log("Catalog reset complete. Imported books and dependent club book state were removed.");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
