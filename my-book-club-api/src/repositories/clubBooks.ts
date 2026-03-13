import { pool } from "../db/pool.js";
import { ClubBook } from "../domain/entities/index.js";

export async function addClubBook(input: ClubBook): Promise<ClubBook> {
  const row = input.toDatabase();
  const result = await pool.query(
    `INSERT INTO club_books (id, club_id, user_id, book_id, status, notes, rating, is_current_read, added_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, club_id, user_id, book_id, status, notes, rating, is_current_read, added_at`,
    [
      row.id,
      row.club_id,
      row.user_id,
      row.book_id,
      row.status,
      row.notes,
      row.rating,
      row.is_current_read,
      row.added_at,
    ]
  );

  return ClubBook.fromDatabase(result.rows[0]);
}

export async function findClubBook(clubId: string, userId: string, bookId: string): Promise<ClubBook | null> {
  const result = await pool.query(
    `SELECT id, club_id, user_id, book_id, status, notes, rating, is_current_read, added_at
     FROM club_books
     WHERE club_id = $1 AND user_id = $2 AND book_id = $3`,
    [clubId, userId, bookId]
  );

  return result.rows[0] ? ClubBook.fromDatabase(result.rows[0]) : null;
}

export async function listClubBooksByClubId(clubId: string): Promise<ClubBook[]> {
  const result = await pool.query(
    `SELECT id, club_id, user_id, book_id, status, notes, rating, is_current_read, added_at
     FROM club_books
     WHERE club_id = $1
     ORDER BY added_at DESC`,
    [clubId]
  );

  return result.rows.map((row) => ClubBook.fromDatabase(row));
}

export async function listClubBooksByClubAndUser(clubId: string, userId: string): Promise<ClubBook[]> {
  const result = await pool.query(
    `SELECT id, club_id, user_id, book_id, status, notes, rating, is_current_read, added_at
     FROM club_books
     WHERE club_id = $1 AND user_id = $2
     ORDER BY added_at DESC`,
    [clubId, userId]
  );

  return result.rows.map((row) => ClubBook.fromDatabase(row));
}

export async function listClubBooksByBookId(bookId: string): Promise<ClubBook[]> {
  const result = await pool.query(
    `SELECT id, club_id, user_id, book_id, status, notes, rating, is_current_read, added_at
     FROM club_books
     WHERE book_id = $1
     ORDER BY added_at DESC`,
    [bookId]
  );

  return result.rows.map((row) => ClubBook.fromDatabase(row));
}

export async function updateClubBook(
  clubId: string,
  userId: string,
  bookId: string,
  updates: Partial<Pick<ClubBook, "status" | "notes" | "rating" | "isCurrentRead">>
): Promise<ClubBook | null> {
  const values: Array<string | number | boolean | null> = [];
  const assignments: string[] = [];

  if (updates.status !== undefined) {
    values.push(updates.status);
    assignments.push(`status = $${values.length}`);
  }

  if (updates.notes !== undefined) {
    values.push(updates.notes);
    assignments.push(`notes = $${values.length}`);
  }

  if (updates.rating !== undefined) {
    values.push(updates.rating);
    assignments.push(`rating = $${values.length}`);
  }

  if (updates.isCurrentRead !== undefined) {
    values.push(updates.isCurrentRead);
    assignments.push(`is_current_read = $${values.length}`);
  }

  if (assignments.length === 0) {
    return findClubBook(clubId, userId, bookId);
  }

  values.push(clubId, userId, bookId);
  const result = await pool.query(
    `UPDATE club_books
     SET ${assignments.join(", ")}
     WHERE club_id = $${values.length - 2} AND user_id = $${values.length - 1} AND book_id = $${values.length}
     RETURNING id, club_id, user_id, book_id, status, notes, rating, is_current_read, added_at`,
    values
  );

  return result.rows[0] ? ClubBook.fromDatabase(result.rows[0]) : null;
}

export async function removeClubBook(clubId: string, userId: string, bookId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM club_books WHERE club_id = $1 AND user_id = $2 AND book_id = $3`,
    [clubId, userId, bookId]
  );

  return (result.rowCount ?? 0) > 0;
}
