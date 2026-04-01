import { pool } from "../db/pool.js";
import { Book } from "../domain/entities/index.js";

type BookSearchFilters = {
  query?: string;
  genre?: string;
  genres?: string[];
  embedding?: number[] | null;
  limit?: number;
};

function normalizeSeedList(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean)));
}

function toVectorLiteral(values: number[] | null | undefined): string | null {
  if (!values || values.length === 0) {
    return null;
  }

  return `[${values.join(",")}]`;
}

function getSelectClause() {
  return `SELECT id, external_id, source, work_key, author_keys, subjects, language,
       title, author, genre, description, synopsis, isbn_10, isbn_13,
       cover_image_url, published_at, page_count, embedding, embedding_vector,
       embedding_model, popularity_score, created_at
     FROM books`;
}

export async function createBook(input: Book): Promise<Book> {
  const row = input.toDatabase();
  const result = await pool.query(
    `INSERT INTO books (
       id, external_id, source, work_key, author_keys, subjects, language,
       title, author, genre, description, synopsis, isbn_10, isbn_13,
       cover_image_url, published_at, page_count, embedding, embedding_model,
       popularity_score, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
     RETURNING id, external_id, source, work_key, author_keys, subjects, language,
       title, author, genre, description, synopsis, isbn_10, isbn_13,
       cover_image_url, published_at, page_count, embedding, embedding_vector,
       embedding_model, popularity_score, created_at`,
    [
      row.id,
      row.external_id,
      row.source,
      row.work_key,
      row.author_keys,
      row.subjects,
      row.language,
      row.title,
      row.author,
      row.genre,
      row.description,
      row.synopsis,
      row.isbn_10,
      row.isbn_13,
      row.cover_image_url,
      row.published_at,
      row.page_count,
      row.embedding,
      row.embedding_model,
      row.popularity_score,
      row.created_at,
    ]
  );

  return Book.fromDatabase(result.rows[0]);
}

export async function upsertBook(input: Book): Promise<Book> {
  const row = input.toDatabase();
  const result = await pool.query(
    `INSERT INTO books (
       id, external_id, source, work_key, author_keys, subjects, language,
       title, author, genre, description, synopsis, isbn_10, isbn_13,
       cover_image_url, published_at, page_count, embedding, embedding_model,
       popularity_score, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
     ON CONFLICT (id)
     DO UPDATE SET
       external_id = EXCLUDED.external_id,
       source = EXCLUDED.source,
       work_key = COALESCE(EXCLUDED.work_key, books.work_key),
       author_keys = CASE
         WHEN cardinality(EXCLUDED.author_keys) > 0 THEN EXCLUDED.author_keys
         ELSE books.author_keys
       END,
       subjects = CASE
         WHEN cardinality(EXCLUDED.subjects) > 0 THEN EXCLUDED.subjects
         ELSE books.subjects
       END,
       language = COALESCE(EXCLUDED.language, books.language),
       title = EXCLUDED.title,
       author = CASE
         WHEN EXCLUDED.author <> 'Unknown author' THEN EXCLUDED.author
         ELSE books.author
       END,
       genre = CASE
         WHEN EXCLUDED.genre <> '' THEN EXCLUDED.genre
         ELSE books.genre
       END,
       description = CASE
         WHEN EXCLUDED.description <> '' THEN EXCLUDED.description
         ELSE books.description
       END,
       synopsis = CASE
         WHEN EXCLUDED.synopsis <> '' THEN EXCLUDED.synopsis
         ELSE books.synopsis
       END,
       isbn_10 = COALESCE(EXCLUDED.isbn_10, books.isbn_10),
       isbn_13 = COALESCE(EXCLUDED.isbn_13, books.isbn_13),
       cover_image_url = COALESCE(EXCLUDED.cover_image_url, books.cover_image_url),
       published_at = COALESCE(EXCLUDED.published_at, books.published_at),
       page_count = COALESCE(EXCLUDED.page_count, books.page_count),
       embedding = COALESCE(EXCLUDED.embedding, books.embedding),
       embedding_model = COALESCE(EXCLUDED.embedding_model, books.embedding_model),
       popularity_score = GREATEST(EXCLUDED.popularity_score, books.popularity_score)
     RETURNING id, external_id, source, work_key, author_keys, subjects, language,
       title, author, genre, description, synopsis, isbn_10, isbn_13,
       cover_image_url, published_at, page_count, embedding, embedding_vector,
       embedding_model, popularity_score, created_at`,
    [
      row.id,
      row.external_id,
      row.source,
      row.work_key,
      row.author_keys,
      row.subjects,
      row.language,
      row.title,
      row.author,
      row.genre,
      row.description,
      row.synopsis,
      row.isbn_10,
      row.isbn_13,
      row.cover_image_url,
      row.published_at,
      row.page_count,
      row.embedding,
      row.embedding_model,
      row.popularity_score,
      row.created_at,
    ]
  );

  return Book.fromDatabase(result.rows[0]);
}

export async function updateBookEmbedding(
  id: string,
  embedding: number[],
  embeddingModel: string
): Promise<Book | null> {
  const vectorLiteral = toVectorLiteral(embedding);
  const result = await pool.query(
    `UPDATE books
     SET embedding = $2,
         embedding_vector = CASE
           WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'books' AND column_name = 'embedding_vector')
           THEN $3::vector
           ELSE embedding_vector
         END,
         embedding_model = $4
     WHERE id = $1
     RETURNING id, external_id, source, work_key, author_keys, subjects, language,
       title, author, genre, description, synopsis, isbn_10, isbn_13,
       cover_image_url, published_at, page_count, embedding, embedding_vector,
       embedding_model, popularity_score, created_at`,
    [id, embedding, vectorLiteral, embeddingModel]
  );

  return result.rows[0] ? Book.fromDatabase(result.rows[0]) : null;
}

export async function updateBookEnrichment(input: Book): Promise<Book | null> {
  const row = input.toDatabase();
  const result = await pool.query(
    `UPDATE books
     SET genre = CASE
           WHEN trim(COALESCE($2, '')) <> '' THEN $2
           ELSE genre
         END,
         description = CASE
           WHEN trim(COALESCE($3, '')) <> '' THEN $3
           ELSE description
         END,
         synopsis = CASE
           WHEN trim(COALESCE($4, '')) <> '' THEN $4
           ELSE synopsis
         END,
         cover_image_url = COALESCE($5, cover_image_url),
         published_at = COALESCE($6, published_at),
         page_count = COALESCE($7, page_count)
     WHERE id = $1
     RETURNING id, external_id, source, work_key, author_keys, subjects, language,
       title, author, genre, description, synopsis, isbn_10, isbn_13,
       cover_image_url, published_at, page_count, embedding, embedding_vector,
       embedding_model, popularity_score, created_at`,
    [row.id, row.genre, row.description, row.synopsis, row.cover_image_url, row.published_at, row.page_count]
  );

  return result.rows[0] ? Book.fromDatabase(result.rows[0]) : null;
}

export async function findBookById(id: string): Promise<Book | null> {
  const result = await pool.query(`${getSelectClause()} WHERE id = $1`, [id]);

  return result.rows[0] ? Book.fromDatabase(result.rows[0]) : null;
}

export async function findBookByIsbn(isbn: string): Promise<Book | null> {
  const result = await pool.query(`${getSelectClause()} WHERE isbn_10 = $1 OR isbn_13 = $1`, [isbn]);

  return result.rows[0] ? Book.fromDatabase(result.rows[0]) : null;
}

export async function findBookByWorkKey(workKey: string): Promise<Book | null> {
  const result = await pool.query(`${getSelectClause()} WHERE work_key = $1`, [workKey]);

  return result.rows[0] ? Book.fromDatabase(result.rows[0]) : null;
}

export async function updatePrimaryAuthorByAuthorKey(authorKey: string, authorName: string): Promise<number> {
  const result = await pool.query(
    `UPDATE books
     SET author = $2
     WHERE cardinality(author_keys) > 0
       AND author_keys[1] = $1
       AND (author = $1 OR author = 'Unknown author')`,
    [authorKey, authorName]
  );

  return result.rowCount ?? 0;
}

export async function listBooksByIds(ids: string[]): Promise<Book[]> {
  if (ids.length === 0) {
    return [];
  }

  const result = await pool.query(
    `${getSelectClause()}
     WHERE id = ANY($1::text[])
     ORDER BY popularity_score DESC, created_at DESC`,
    [ids]
  );

  return result.rows.map((row) => Book.fromDatabase(row));
}

export async function listBooksByAuthorSeeds(authorSeeds: string[], limit = 20): Promise<Book[]> {
  const normalizedSeeds = normalizeSeedList(authorSeeds);

  if (normalizedSeeds.length === 0) {
    return [];
  }

  const clauses: string[] = [];
  const values: string[] = [];

  for (const seed of normalizedSeeds) {
    values.push(seed, `%${seed}%`);
    const exactIndex = values.length - 1;
    const likeIndex = values.length;
    clauses.push(`LOWER(author) = $${exactIndex} OR LOWER(author) LIKE $${likeIndex}`);
  }

  const result = await pool.query(
    `${getSelectClause()}
     WHERE ${clauses.map((clause) => `(${clause})`).join(" OR ")}
     ORDER BY popularity_score DESC, created_at DESC
     LIMIT ${Math.min(Math.max(limit, 1), 100)}`,
    values
  );

  return result.rows.map((row) => Book.fromDatabase(row));
}

export async function listBooksByTitleSeeds(titleSeeds: string[], limit = 20): Promise<Book[]> {
  const normalizedSeeds = normalizeSeedList(titleSeeds);

  if (normalizedSeeds.length === 0) {
    return [];
  }

  const clauses: string[] = [];
  const values: string[] = [];

  for (const seed of normalizedSeeds) {
    values.push(seed, `%${seed}%`);
    const exactIndex = values.length - 1;
    const likeIndex = values.length;
    clauses.push(`LOWER(title) = $${exactIndex} OR LOWER(title) LIKE $${likeIndex}`);
  }

  const result = await pool.query(
    `${getSelectClause()}
     WHERE ${clauses.map((clause) => `(${clause})`).join(" OR ")}
     ORDER BY popularity_score DESC, created_at DESC
     LIMIT ${Math.min(Math.max(limit, 1), 100)}`,
    values
  );

  return result.rows.map((row) => Book.fromDatabase(row));
}

export async function listBooks(filters: BookSearchFilters = {}): Promise<Book[]> {
  const values: Array<string | number> = [];
  const where: string[] = [];
  let textRankClause = "0::double precision AS text_rank";
  let semanticScoreClause = "0::double precision AS semantic_score";
  let textRankOrderExpression = "0::double precision";
  let semanticScoreOrderExpression = "0::double precision";

  if (filters.query) {
    values.push(filters.query);
    const queryIndex = values.length;
    textRankClause = `ts_rank_cd(
      to_tsvector(
        'english',
        coalesce(title, '') || ' ' ||
        coalesce(author, '') || ' ' ||
        coalesce(genre, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(synopsis, '') || ' ' ||
        coalesce(array_to_string(subjects, ' '), '')
      ),
      websearch_to_tsquery('english', $${queryIndex})
    ) AS text_rank`;
    textRankOrderExpression = `ts_rank_cd(
      to_tsvector(
        'english',
        coalesce(title, '') || ' ' ||
        coalesce(author, '') || ' ' ||
        coalesce(genre, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(synopsis, '') || ' ' ||
        coalesce(array_to_string(subjects, ' '), '')
      ),
      websearch_to_tsquery('english', $${queryIndex})
    )`;

    if (!filters.embedding || filters.embedding.length === 0) {
      values.push(`%${filters.query.toLowerCase()}%`);
      const likeIndex = values.length;
      where.push(
        `(
          to_tsvector(
            'english',
            coalesce(title, '') || ' ' ||
            coalesce(author, '') || ' ' ||
            coalesce(genre, '') || ' ' ||
            coalesce(description, '') || ' ' ||
            coalesce(synopsis, '') || ' ' ||
            coalesce(array_to_string(subjects, ' '), '')
          ) @@ websearch_to_tsquery('english', $${queryIndex})
          OR LOWER(title) LIKE $${likeIndex}
          OR LOWER(author) LIKE $${likeIndex}
          OR LOWER(description) LIKE $${likeIndex}
          OR LOWER(synopsis) LIKE $${likeIndex}
          OR EXISTS (
            SELECT 1 FROM unnest(subjects) AS subject
            WHERE LOWER(subject) LIKE $${likeIndex}
          )
        )`
      );
    }
  }

  if (filters.genre) {
    values.push(filters.genre.toLowerCase());
    where.push(`LOWER(genre) = $${values.length}`);
  }

  if (filters.genres && filters.genres.length > 0) {
    const clauses = filters.genres
      .filter(Boolean)
      .map((genre) => {
        values.push(`%${genre.toLowerCase()}%`);
        return `LOWER(genre) LIKE $${values.length}`;
      });

    if (clauses.length > 0) {
      where.push(`(${clauses.join(" OR ")})`);
    }
  }

  if (filters.embedding && filters.embedding.length > 0) {
    values.push(toVectorLiteral(filters.embedding) || "[]");
    semanticScoreClause = `CASE
      WHEN embedding_vector IS NOT NULL THEN 1 - (embedding_vector <=> $${values.length}::vector)
      ELSE 0
    END AS semantic_score`;
    semanticScoreOrderExpression = `CASE
      WHEN embedding_vector IS NOT NULL THEN 1 - (embedding_vector <=> $${values.length}::vector)
      ELSE 0
    END`;
  }

  const limitClause = filters.limit && filters.limit > 0 ? `LIMIT ${Math.min(filters.limit, 50)}` : "";

  const result = await pool.query(
    `SELECT id, external_id, source, work_key, author_keys, subjects, language,
       title, author, genre, description, synopsis, isbn_10, isbn_13,
       cover_image_url, published_at, page_count, embedding, embedding_vector,
       embedding_model, popularity_score, created_at,
       ${textRankClause},
       ${semanticScoreClause}
     FROM books
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY (${textRankOrderExpression} * 0.65) + (${semanticScoreOrderExpression} * 0.3) + LEAST(popularity_score, 1000) * 0.0005 DESC,
       popularity_score DESC,
       created_at DESC
     ${limitClause}`,
    values
  );

  return result.rows.map((row) => Book.fromDatabase(row));
}

export async function listBooksWithoutEmbeddings(limit = 100): Promise<Book[]> {
  const result = await pool.query(
    `SELECT id, external_id, source, work_key, author_keys, subjects, language,
       title, author, genre, description, synopsis, isbn_10, isbn_13,
       cover_image_url, published_at, page_count, embedding, embedding_vector,
       embedding_model, popularity_score, created_at
     FROM books
     WHERE embedding IS NULL
        OR cardinality(embedding) = 0
        OR embedding_vector IS NULL
     ORDER BY popularity_score DESC, created_at DESC
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 2000)]
  );

  return result.rows.map((row) => Book.fromDatabase(row));
}
