import { pool } from "../db/pool.js";
import { Book } from "../domain/entities/index.js";

type BookSearchFilters = {
  query?: string;
  genre?: string;
};

export async function createBook(input: Book): Promise<Book> {
  const row = input.toDatabase();
  const result = await pool.query(
    `INSERT INTO books (
       id, title, author, genre, description, synopsis, isbn_10, isbn_13,
       cover_image_url, published_at, page_count, embedding, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id, title, author, genre, description, synopsis, isbn_10, isbn_13,
       cover_image_url, published_at, page_count, embedding, created_at`,
    [
      row.id,
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
      row.created_at,
    ]
  );

  return Book.fromDatabase(result.rows[0]);
}

export async function findBookById(id: string): Promise<Book | null> {
  const result = await pool.query(
    `SELECT id, title, author, genre, description, synopsis, isbn_10, isbn_13,
       cover_image_url, published_at, page_count, embedding, created_at
     FROM books
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] ? Book.fromDatabase(result.rows[0]) : null;
}

export async function findBookByIsbn(isbn: string): Promise<Book | null> {
  const result = await pool.query(
    `SELECT id, title, author, genre, description, synopsis, isbn_10, isbn_13,
       cover_image_url, published_at, page_count, embedding, created_at
     FROM books
     WHERE isbn_10 = $1 OR isbn_13 = $1`,
    [isbn]
  );

  return result.rows[0] ? Book.fromDatabase(result.rows[0]) : null;
}

export async function listBooksByIds(ids: string[]): Promise<Book[]> {
  if (ids.length === 0) {
    return [];
  }

  const result = await pool.query(
    `SELECT id, title, author, genre, description, synopsis, isbn_10, isbn_13,
       cover_image_url, published_at, page_count, embedding, created_at
     FROM books
     WHERE id = ANY($1::text[])
     ORDER BY created_at DESC`,
    [ids]
  );

  return result.rows.map((row) => Book.fromDatabase(row));
}

export async function listBooks(filters: BookSearchFilters = {}): Promise<Book[]> {
  const values: string[] = [];
  const where: string[] = [];

  if (filters.query) {
    values.push(`%${filters.query.toLowerCase()}%`);
    where.push(
      `(LOWER(title) LIKE $${values.length} OR LOWER(author) LIKE $${values.length} OR LOWER(description) LIKE $${values.length} OR LOWER(synopsis) LIKE $${values.length})`
    );
  }

  if (filters.genre) {
    values.push(filters.genre.toLowerCase());
    where.push(`LOWER(genre) = $${values.length}`);
  }

  const result = await pool.query(
    `SELECT id, title, author, genre, description, synopsis, isbn_10, isbn_13,
       cover_image_url, published_at, page_count, embedding, created_at
     FROM books
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC`,
    values
  );

  return result.rows.map((row) => Book.fromDatabase(row));
}
