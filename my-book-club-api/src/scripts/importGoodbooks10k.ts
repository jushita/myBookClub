import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import "../config/env.js";
import { findBookByIsbn, upsertBook } from "../repositories/books.js";
import { Book } from "../domain/entities/Book.js";

type GoodbooksRow = Record<string, string>;

function getArg(name: string): string | undefined {
  const index = process.argv.findIndex((value) => value === `--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function toRow(headers: string[], values: string[]): GoodbooksRow {
  return headers.reduce<GoodbooksRow>((row, header, index) => {
    row[header] = values[index] ?? "";
    return row;
  }, {});
}

function clean(value: string | undefined): string {
  return String(value || "").trim();
}

function parseYear(value: string): Date | null {
  const normalized = clean(value);
  const year = Number(normalized);

  if (!Number.isFinite(year) || year <= 0) {
    return null;
  }

  const parsed = new Date(`${Math.trunc(year)}-01-01T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseNumber(value: string): number {
  const normalized = clean(value).replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLanguage(value: string): string | null {
  const normalized = clean(value).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "en" || normalized === "eng" || normalized.startsWith("en-")) {
    return "eng";
  }

  return normalized;
}

function buildPopularityScore(row: GoodbooksRow): number {
  const ratingsCount = parseNumber(row.ratings_count);
  const workRatingsCount = parseNumber(row.work_ratings_count);
  const textReviewsCount = parseNumber(row.work_text_reviews_count);
  const averageRating = parseNumber(row.average_rating);

  return ratingsCount * 0.01 + workRatingsCount * 0.002 + textReviewsCount * 0.05 + averageRating * 10;
}

async function main() {
  const file = getArg("file");
  const limit = Number(getArg("limit") || "0");

  if (!file) {
    throw new Error("Missing --file argument. Example: npm run db:import:goodbooks -- --file /path/to/books.csv --limit 1000");
  }

  const resolvedFile = path.resolve(file);
  const input = fs.createReadStream(resolvedFile);
  const reader = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  let headers: string[] | null = null;
  let imported = 0;
  let scanned = 0;

  for await (const line of reader) {
    if (!headers) {
      headers = parseCsvLine(line);
      continue;
    }

    scanned += 1;
    const row = toRow(headers, parseCsvLine(line));

    const bookId = clean(row.book_id || row.id);
    const title = clean(row.original_title) || clean(row.title);
    const author = clean(row.authors);

    if (!bookId || !title || !author) {
      continue;
    }

    const isbn10 = clean(row.isbn) || null;
    const isbn13 = clean(row.isbn13) || null;
    const existingBook = isbn13 ? await findBookByIsbn(isbn13) : isbn10 ? await findBookByIsbn(isbn10) : null;
    const targetId = existingBook?.id || `goodbooks:${bookId}`;

    await upsertBook(
      new Book({
        id: targetId,
        externalId: bookId,
        source: "goodbooks10k",
        language: normalizeLanguage(row.language_code),
        title,
        author,
        genre: "",
        description: "",
        synopsis: "",
        isbn10,
        isbn13,
        coverImageUrl: clean(row.image_url) || clean(row.small_image_url) || null,
        publishedAt: parseYear(row.original_publication_year),
        popularityScore: buildPopularityScore(row),
      })
    );

    imported += 1;

    if (imported % 500 === 0) {
      console.log(`Imported ${imported} Goodbooks rows (${scanned} scanned)`);
    }

    if (limit > 0 && imported >= limit) {
      break;
    }
  }

  console.log(`Done. Imported ${imported} Goodbooks rows from ${resolvedFile}. Scanned ${scanned} rows.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
