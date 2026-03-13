import { pool } from "../db/pool.js";
import { User } from "../domain/entities/index.js";

export async function findUserById(id: string): Promise<User | null> {
  const result = await pool.query(
    `SELECT id, name, email, password_hash, provider, provider_user_id, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] ? User.fromDatabase(result.rows[0]) : null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query(
    `SELECT id, name, email, password_hash, provider, provider_user_id, created_at
     FROM users
     WHERE email = $1`,
    [email]
  );

  return result.rows[0] ? User.fromDatabase(result.rows[0]) : null;
}

export async function listUsersByIds(ids: string[]): Promise<User[]> {
  if (ids.length === 0) {
    return [];
  }

  const result = await pool.query(
    `SELECT id, name, email, password_hash, provider, provider_user_id, created_at
     FROM users
     WHERE id = ANY($1::text[])`,
    [ids]
  );

  return result.rows.map((row) => User.fromDatabase(row));
}

export async function createUser(input: User): Promise<User> {
  const row = input.toDatabase();
  const result = await pool.query(
    `INSERT INTO users (id, name, email, password_hash, provider, provider_user_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, email, password_hash, provider, provider_user_id, created_at`,
    [
      row.id,
      row.name,
      row.email,
      row.password_hash,
      row.provider,
      row.provider_user_id,
      row.created_at,
    ]
  );

  return User.fromDatabase(result.rows[0]);
}
