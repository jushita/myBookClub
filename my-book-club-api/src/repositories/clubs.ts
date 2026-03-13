import { pool } from "../db/pool.js";
import { Club } from "../domain/entities/index.js";

type ClubListFilters = {
  createdByUserId?: string;
};

export async function createClub(input: Club): Promise<Club> {
  const row = input.toDatabase();
  const result = await pool.query(
    `INSERT INTO clubs (id, name, description, vibe, created_by_user_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, description, vibe, created_by_user_id, created_at`,
    [row.id, row.name, row.description, row.vibe, row.created_by_user_id, row.created_at]
  );

  return Club.fromDatabase(result.rows[0]);
}

export async function findClubById(id: string): Promise<Club | null> {
  const result = await pool.query(
    `SELECT id, name, description, vibe, created_by_user_id, created_at
     FROM clubs
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] ? Club.fromDatabase(result.rows[0]) : null;
}

export async function listClubs(filters: ClubListFilters = {}): Promise<Club[]> {
  const values: string[] = [];
  const where: string[] = [];

  if (filters.createdByUserId) {
    values.push(filters.createdByUserId);
    where.push(`created_by_user_id = $${values.length}`);
  }

  const result = await pool.query(
    `SELECT id, name, description, vibe, created_by_user_id, created_at
     FROM clubs
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC`,
    values
  );

  return result.rows.map((row) => Club.fromDatabase(row));
}

export async function listClubsForUser(userId: string): Promise<Club[]> {
  const result = await pool.query(
    `SELECT c.id, c.name, c.description, c.vibe, c.created_by_user_id, c.created_at
     FROM clubs c
     INNER JOIN club_members cm ON cm.club_id = c.id
     WHERE cm.user_id = $1
     ORDER BY c.created_at DESC`,
    [userId]
  );

  return result.rows.map((row) => Club.fromDatabase(row));
}

export async function updateClub(
  id: string,
  updates: Partial<Pick<Club, "name" | "description" | "vibe">>
): Promise<Club | null> {
  const values: string[] = [];
  const assignments: string[] = [];

  if (updates.name !== undefined) {
    values.push(String(updates.name).trim());
    assignments.push(`name = $${values.length}`);
  }

  if (updates.description !== undefined) {
    values.push(String(updates.description));
    assignments.push(`description = $${values.length}`);
  }

  if (updates.vibe !== undefined) {
    values.push(String(updates.vibe));
    assignments.push(`vibe = $${values.length}`);
  }

  if (assignments.length === 0) {
    return findClubById(id);
  }

  values.push(id);
  const result = await pool.query(
    `UPDATE clubs
     SET ${assignments.join(", ")}
     WHERE id = $${values.length}
     RETURNING id, name, description, vibe, created_by_user_id, created_at`,
    values
  );

  return result.rows[0] ? Club.fromDatabase(result.rows[0]) : null;
}

export async function deleteClub(id: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM clubs WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}
