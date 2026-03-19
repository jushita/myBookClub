import { pool } from "../db/pool.js";

export type ClubDiscussionQuestionsRecord = {
  id: string;
  clubId: string;
  bookId: string;
  questions: string[];
  createdAt: Date;
  updatedAt: Date;
};

type ClubDiscussionQuestionsRow = {
  id: string;
  club_id: string;
  book_id: string;
  questions: string[];
  created_at: Date | string;
  updated_at: Date | string;
};

function fromRow(row: ClubDiscussionQuestionsRow): ClubDiscussionQuestionsRecord {
  return {
    id: row.id,
    clubId: row.club_id,
    bookId: row.book_id,
    questions: Array.isArray(row.questions) ? row.questions.map((question) => String(question).trim()).filter(Boolean) : [],
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  };
}

export async function findDiscussionQuestionsForClubBook(
  clubId: string,
  bookId: string
): Promise<ClubDiscussionQuestionsRecord | null> {
  const result = await pool.query(
    `SELECT id, club_id, book_id, questions, created_at, updated_at
     FROM club_discussion_questions
     WHERE club_id = $1 AND book_id = $2`,
    [clubId, bookId]
  );

  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function upsertDiscussionQuestionsForClubBook(input: {
  id: string;
  clubId: string;
  bookId: string;
  questions: string[];
}): Promise<ClubDiscussionQuestionsRecord> {
  const result = await pool.query(
    `INSERT INTO club_discussion_questions (id, club_id, book_id, questions)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (club_id, book_id)
     DO UPDATE SET questions = EXCLUDED.questions, updated_at = NOW()
     RETURNING id, club_id, book_id, questions, created_at, updated_at`,
    [input.id, input.clubId, input.bookId, input.questions]
  );

  return fromRow(result.rows[0]);
}
