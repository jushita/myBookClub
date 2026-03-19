import { pool } from "../db/pool.js";

export type RecommendationCacheRecord = {
  id: string;
  promptKey: string;
  normalizedPrompt: string;
  resultLimit: number;
  searchPlan: Record<string, unknown>;
  books: Record<string, unknown>[];
  createdAt: Date;
  updatedAt: Date;
};

type RecommendationCacheRow = {
  id: string;
  prompt_key: string;
  normalized_prompt: string;
  result_limit: number;
  search_plan: Record<string, unknown>;
  books: Record<string, unknown>[];
  created_at: Date | string;
  updated_at: Date | string;
};

function fromRow(row: RecommendationCacheRow): RecommendationCacheRecord {
  return {
    id: row.id,
    promptKey: row.prompt_key,
    normalizedPrompt: row.normalized_prompt,
    resultLimit: row.result_limit,
    searchPlan: row.search_plan ?? {},
    books: Array.isArray(row.books) ? row.books : [],
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  };
}

export async function findRecommendationCache(promptKey: string): Promise<RecommendationCacheRecord | null> {
  const result = await pool.query(
    `SELECT id, prompt_key, normalized_prompt, result_limit, search_plan, books, created_at, updated_at
     FROM recommendation_cache
     WHERE prompt_key = $1`,
    [promptKey]
  );

  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function upsertRecommendationCache(input: {
  id: string;
  promptKey: string;
  normalizedPrompt: string;
  resultLimit: number;
  searchPlan: Record<string, unknown>;
  books: Record<string, unknown>[];
}): Promise<RecommendationCacheRecord> {
  const result = await pool.query(
    `INSERT INTO recommendation_cache (id, prompt_key, normalized_prompt, result_limit, search_plan, books)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
     ON CONFLICT (prompt_key)
     DO UPDATE SET
       normalized_prompt = EXCLUDED.normalized_prompt,
       result_limit = EXCLUDED.result_limit,
       search_plan = EXCLUDED.search_plan,
       books = EXCLUDED.books,
       updated_at = NOW()
     RETURNING id, prompt_key, normalized_prompt, result_limit, search_plan, books, created_at, updated_at`,
    [input.id, input.promptKey, input.normalizedPrompt, input.resultLimit, JSON.stringify(input.searchPlan), JSON.stringify(input.books)]
  );

  return fromRow(result.rows[0]);
}
