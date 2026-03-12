import { pool } from "../db/pool.js";

export async function findUserByEmail(email) {
  const result = await pool.query(
    `SELECT id, name, email, password_hash AS "passwordHash", provider, provider_user_id AS "providerUserId"
     FROM users
     WHERE email = $1`,
    [email]
  );

  return result.rows[0] || null;
}

export async function createUser(input) {
  const result = await pool.query(
    `INSERT INTO users (id, name, email, password_hash, provider, provider_user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, password_hash AS "passwordHash", provider, provider_user_id AS "providerUserId"`,
    [input.id, input.name, input.email, input.passwordHash, input.provider, input.providerUserId]
  );

  return result.rows[0];
}
