import type { Book } from "../types";
import { getBookCoverUrl } from "../data/bookCoverFallbacks";
import { normalizeGenreLabel, pickDisplaySummary } from "./bookPresentation";
import { apiBaseUrl, requestJson } from "./http";

type ApiBook = {
  id: string;
  title: string;
  author: string;
  genre: string;
  description?: string;
  synopsis?: string;
  coverImageUrl?: string | null;
  averageRating?: number | null;
  ratingsCount?: number | null;
};

const BOOK_DETAILS_CACHE_TTL_MS = 10 * 60 * 1000;
const bookDetailsCache = new Map<string, { expiresAt: number; book: Book }>();
const pendingBookDetails = new Map<string, Promise<Book>>();

function mergeBookDetails(base: Book, details: Book): Book {
  return {
    ...base,
    ...details,
    genre: details.genre || base.genre,
    note: details.note || base.note,
    description: details.description || base.description || base.note,
    synopsis: details.synopsis || base.synopsis || base.description || base.note,
    coverImageUrl: details.coverImageUrl ?? base.coverImageUrl ?? null,
    averageRating: details.averageRating ?? base.averageRating ?? null,
    ratingsCount: details.ratingsCount ?? base.ratingsCount ?? null,
  };
}

function toBook(apiBook: ApiBook): Book {
  const coverImageUrl = getBookCoverUrl({
    title: apiBook.title,
    author: apiBook.author,
    coverImageUrl: apiBook.coverImageUrl ?? null,
  });
  const summary = pickDisplaySummary(apiBook);

  return {
    id: apiBook.id,
    title: apiBook.title,
    author: apiBook.author,
    genre: normalizeGenreLabel(apiBook.genre),
    note: summary.note,
    description: summary.description,
    synopsis: summary.synopsis,
    coverImageUrl,
    averageRating: typeof apiBook.averageRating === "number" ? apiBook.averageRating : null,
    ratingsCount: typeof apiBook.ratingsCount === "number" ? apiBook.ratingsCount : null,
  };
}

export async function fetchBooks(query?: string, limit = 50): Promise<Book[]> {
  const params = new URLSearchParams();

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  params.set("limit", String(limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const data = await requestJson<{ books: ApiBook[] }>(`${apiBaseUrl}/api/books${suffix}`);
  return data.books.map(toBook);
}

export async function createBook(input: {
  title: string;
  author: string;
  genre: string;
  description: string;
}): Promise<Book> {
  const data = await requestJson<{ book: ApiBook }>(`${apiBaseUrl}/api/books`, {
    method: "POST",
    body: JSON.stringify(input),
  });

  return toBook(data.book);
}

export async function fetchBookDetails(bookId: string): Promise<Book> {
  const cached = bookDetailsCache.get(bookId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.book;
  }

  const pending = pendingBookDetails.get(bookId);
  if (pending) {
    return pending;
  }

  const request = requestJson<{ book: ApiBook }>(`${apiBaseUrl}/api/books/${encodeURIComponent(bookId)}`)
    .then((data) => {
      const book = toBook(data.book);
      bookDetailsCache.set(bookId, {
        book,
        expiresAt: Date.now() + BOOK_DETAILS_CACHE_TTL_MS,
      });
      pendingBookDetails.delete(bookId);
      return book;
    })
    .catch((error) => {
      pendingBookDetails.delete(bookId);
      throw error;
    });

  pendingBookDetails.set(bookId, request);
  return request;
}

export async function prewarmBookDetails(
  books: Book[],
  onHydrate?: (book: Book) => void,
  limit = 3
): Promise<void> {
  await Promise.all(
    books.slice(0, limit).map(async (book) => {
      try {
        const details = await fetchBookDetails(book.id);
        onHydrate?.(mergeBookDetails(book, details));
      } catch {
        // ignore prewarm failures
      }
    })
  );
}

export function mergeDetailedBook(base: Book, details: Book): Book {
  return mergeBookDetails(base, details);
}
