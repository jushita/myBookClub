import { pool } from "../db/pool.js";

export type ClubInsightRecord = {
  id: string;
  clubId: string;
  shelfFingerprint: string;
  headline: string;
  summary: string;
  signals: string[];
  source: string;
  createdAt: Date;
  updatedAt: Date;
};

type ClubInsightRow = {
  id: string;
  club_id: string;
  shelf_fingerprint: string;
  headline: string;
  summary: string;
  signals: string[];
  source: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function fromRow(row: ClubInsightRow): ClubInsightRecord {
  return {
    id: row.id,
    clubId: row.club_id,
    shelfFingerprint: row.shelf_fingerprint,
    headline: row.headline,
    summary: row.summary,
    signals: Array.isArray(row.signals) ? row.signals.map((signal) => String(signal).trim()).filter(Boolean) : [],
    source: row.source,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  };
}

export async function findClubInsight(clubId: string): Promise<ClubInsightRecord | null> {
  const result = await pool.query(
    `SELECT id, club_id, shelf_fingerprint, headline, summary, signals, source, created_at, updated_at
     FROM club_insights
     WHERE club_id = $1`,
    [clubId]
  );

  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function upsertClubInsight(input: {
  id: string;
  clubId: string;
  shelfFingerprint: string;
  headline: string;
  summary: string;
  signals: string[];
  source: string;
}): Promise<ClubInsightRecord> {
  const result = await pool.query(
    `INSERT INTO club_insights (id, club_id, shelf_fingerprint, headline, summary, signals, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (club_id)
     DO UPDATE SET
       shelf_fingerprint = EXCLUDED.shelf_fingerprint,
       headline = EXCLUDED.headline,
       summary = EXCLUDED.summary,
       signals = EXCLUDED.signals,
       source = EXCLUDED.source,
       updated_at = NOW()
     RETURNING id, club_id, shelf_fingerprint, headline, summary, signals, source, created_at, updated_at`,
    [input.id, input.clubId, input.shelfFingerprint, input.headline, input.summary, input.signals, input.source]
  );

  return fromRow(result.rows[0]);
}
