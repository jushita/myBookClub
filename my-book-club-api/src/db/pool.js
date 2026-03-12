import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("DATABASE_URL is not set. Postgres-backed auth routes will fail until it is configured.");
}

export const pool = new Pool({
  connectionString,
});
