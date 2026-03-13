import { pool } from "../db/pool.js";
import { ClubMember } from "../domain/entities/index.js";

export async function addClubMember(input: ClubMember): Promise<ClubMember> {
  const row = input.toDatabase();
  const result = await pool.query(
    `INSERT INTO club_members (id, club_id, user_id, role, joined_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, club_id, user_id, role, joined_at`,
    [row.id, row.club_id, row.user_id, row.role, row.joined_at]
  );

  return ClubMember.fromDatabase(result.rows[0]);
}

export async function findClubMember(clubId: string, userId: string): Promise<ClubMember | null> {
  const result = await pool.query(
    `SELECT id, club_id, user_id, role, joined_at
     FROM club_members
     WHERE club_id = $1 AND user_id = $2`,
    [clubId, userId]
  );

  return result.rows[0] ? ClubMember.fromDatabase(result.rows[0]) : null;
}

export async function listMembersByClubId(clubId: string): Promise<ClubMember[]> {
  const result = await pool.query(
    `SELECT id, club_id, user_id, role, joined_at
     FROM club_members
     WHERE club_id = $1
     ORDER BY joined_at ASC`,
    [clubId]
  );

  return result.rows.map((row) => ClubMember.fromDatabase(row));
}

export async function listMembershipsByUserId(userId: string): Promise<ClubMember[]> {
  const result = await pool.query(
    `SELECT id, club_id, user_id, role, joined_at
     FROM club_members
     WHERE user_id = $1
     ORDER BY joined_at DESC`,
    [userId]
  );

  return result.rows.map((row) => ClubMember.fromDatabase(row));
}

export async function updateClubMemberRole(
  clubId: string,
  userId: string,
  role: ClubMember["role"]
): Promise<ClubMember | null> {
  const result = await pool.query(
    `UPDATE club_members
     SET role = $3
     WHERE club_id = $1 AND user_id = $2
     RETURNING id, club_id, user_id, role, joined_at`,
    [clubId, userId, role]
  );

  return result.rows[0] ? ClubMember.fromDatabase(result.rows[0]) : null;
}

export async function removeClubMember(clubId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM club_members WHERE club_id = $1 AND user_id = $2`,
    [clubId, userId]
  );

  return (result.rowCount ?? 0) > 0;
}
