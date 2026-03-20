import { Book as BookEntity } from "../domain/entities/Book.js";
import type { Book } from "../domain/entities/Book.js";
import { updateBookEnrichment } from "../repositories/books.js";

type SearchFallbackParams = {
  query?: string;
  genre?: string;
  limit: number;
};

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  subject?: string[];
  cover_i?: number;
  first_publish_year?: number;
  ratings_average?: number;
  ratings_count?: number;
};

type GoogleBooksItem = {
  id?: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string;
    categories?: string[];
    publishedDate?: string;
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };
    averageRating?: number;
    ratingsCount?: number;
  };
};

const LOOKUP_CACHE_TTL_MS = 10 * 60 * 1000;
const metadataCache = new Map<string, { expiresAt: number; book: Book }>();
const queryCache = new Map<string, { expiresAt: number; books: Book[] }>();

function cacheGet<T>(cache: Map<string, { expiresAt: number; [key: string]: unknown }>, key: string, valueKey: string): T | null {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) {
      cache.delete(key);
    }
    return null;
  }

  return entry[valueKey] as T;
}

function cacheSet<T>(cache: Map<string, { expiresAt: number; [key: string]: unknown }>, key: string, valueKey: string, value: T) {
  cache.set(key, {
    expiresAt: Date.now() + LOOKUP_CACHE_TTL_MS,
    [valueKey]: value,
  });
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function tokenizeQuery(query: string): string[] {
  return normalize(query)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function buildSearchText(book: Book): string {
  return normalize(
    [
      book.title,
      book.author,
      book.genre,
      book.description,
      book.synopsis,
      ...(book.subjects ?? []),
      book.isbn10 ?? "",
      book.isbn13 ?? "",
    ].join(" ")
  );
}

function hasStrongLocalMatch(params: SearchFallbackParams, localBooks: Book[]): boolean {
  const rawQuery = normalize(params.query || "");
  const rawGenre = normalize(params.genre || "");

  if (!rawQuery && !rawGenre) {
    return localBooks.length > 0;
  }

  const queryTokens = tokenizeQuery(params.query || "");
  const requiredTokens = queryTokens.length > 0 ? queryTokens : rawGenre ? tokenizeQuery(rawGenre) : [];

  return localBooks.some((book) => {
    const title = normalize(book.title);
    const author = normalize(book.author);
    const genre = normalize(book.genre);
    const searchable = buildSearchText(book);
    const exactTitleAuthor = rawQuery
      ? title.includes(rawQuery) || author.includes(rawQuery) || `${title} ${author}`.includes(rawQuery)
      : false;
    const genreMatch = rawGenre ? genre.includes(rawGenre) : false;
    const tokenCoverage =
      requiredTokens.length > 0
        ? requiredTokens.every((token) => searchable.includes(token))
        : false;

    return exactTitleAuthor || genreMatch || tokenCoverage;
  });
}

function getMetadataCacheKey(book: Pick<Book, "title" | "author" | "isbn13" | "isbn10">): string {
  return [
    normalize(book.title),
    normalize(book.author),
    normalize(book.isbn13 || ""),
    normalize(book.isbn10 || ""),
  ].join("::");
}

function getQueryCacheKey(params: SearchFallbackParams): string {
  return [normalize(params.query || ""), normalize(params.genre || ""), String(params.limit)].join("::");
}

function buildOpenLibraryCoverUrl(coverId?: number): string | null {
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
}

function parsePublishedDate(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const yearMatch = value.match(/\d{4}/);
  return yearMatch ? new Date(`${yearMatch[0]}-01-01`) : null;
}

function buildOpenLibraryBlurb(doc: OpenLibraryDoc): string {
  const author = doc.author_name?.[0] ?? "an unknown author";
  const subjects = (doc.subject ?? []).filter(Boolean).slice(0, 3);
  const year = doc.first_publish_year ? ` First published in ${doc.first_publish_year}.` : "";

  if (subjects.length === 0) {
    return `A book by ${author}.${year}`.trim();
  }

  return `A ${subjects.join(", ").toLowerCase()} pick by ${author}.${year}`.trim();
}

function shouldPersistEnrichment(original: Book, enriched: Book): boolean {
  return (
    original.genre !== enriched.genre ||
    original.description !== enriched.description ||
    original.synopsis !== enriched.synopsis ||
    original.coverImageUrl !== enriched.coverImageUrl ||
    original.publishedAt?.getTime() !== enriched.publishedAt?.getTime() ||
    original.pageCount !== enriched.pageCount
  );
}

async function persistEnrichedBookIfChanged(original: Book, enriched: Book): Promise<void> {
  if (!shouldPersistEnrichment(original, enriched)) {
    return;
  }

  await updateBookEnrichment(enriched).catch(() => undefined);
}

async function searchOpenLibrary(query: string, limit: number): Promise<Book[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(Math.max(limit, 1), 20)),
    fields: "key,title,author_name,subject,cover_i,first_publish_year,ratings_average,ratings_count",
  });

  const response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Open Library returned ${response.status}`);
  }

  const data = (await response.json()) as { docs?: OpenLibraryDoc[] };
  return (data.docs ?? [])
    .filter((doc) => doc.key && doc.title)
    .slice(0, limit)
    .map(
      (doc, index) =>
        new BookEntity({
          id: `openlibrary:${doc.key ?? index}`,
          title: doc.title ?? "Unknown title",
          author: doc.author_name?.[0] ?? "Unknown author",
          genre: (doc.subject ?? []).slice(0, 3).join(", "),
          description: buildOpenLibraryBlurb(doc),
          synopsis: buildOpenLibraryBlurb(doc),
          coverImageUrl: buildOpenLibraryCoverUrl(doc.cover_i),
          publishedAt: doc.first_publish_year ? new Date(`${doc.first_publish_year}-01-01`) : null,
          averageRating: typeof doc.ratings_average === "number" ? doc.ratings_average : null,
          ratingsCount: typeof doc.ratings_count === "number" ? doc.ratings_count : null,
        })
    );
}

async function searchGoogleBooks(query: string, limit: number): Promise<Book[]> {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(Math.min(Math.max(limit, 1), 20)),
    printType: "books",
  });

  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Google Books returned ${response.status}`);
  }

  const data = (await response.json()) as { items?: GoogleBooksItem[] };
  return (data.items ?? [])
    .filter((item) => item.volumeInfo?.title)
    .slice(0, limit)
    .map(
      (item, index) =>
        new BookEntity({
          id: `googlebooks:${item.id ?? index}`,
          title: item.volumeInfo?.title ?? "Unknown title",
          author: item.volumeInfo?.authors?.[0] ?? "Unknown author",
          genre: (item.volumeInfo?.categories ?? []).slice(0, 3).join(", "),
          description: item.volumeInfo?.description ?? "Found through Google Books.",
          synopsis: item.volumeInfo?.description ?? "Found through Google Books.",
          coverImageUrl:
            item.volumeInfo?.imageLinks?.thumbnail ?? item.volumeInfo?.imageLinks?.smallThumbnail ?? null,
          publishedAt: parsePublishedDate(item.volumeInfo?.publishedDate),
          averageRating: typeof item.volumeInfo?.averageRating === "number" ? item.volumeInfo.averageRating : null,
          ratingsCount: typeof item.volumeInfo?.ratingsCount === "number" ? item.volumeInfo.ratingsCount : null,
        })
    );
}

export async function enrichBookFromExternalSources(book: Book): Promise<Book> {
  const cacheKey = getMetadataCacheKey(book);
  const cached = cacheGet<Book>(metadataCache, cacheKey, "book");
  if (cached) {
    return cached;
  }

  let workingBook = book;

  const isbnCoverUrl =
    !workingBook.coverImageUrl && (workingBook.isbn13
      ? `https://covers.openlibrary.org/b/isbn/${workingBook.isbn13}-L.jpg`
      : workingBook.isbn10
        ? `https://covers.openlibrary.org/b/isbn/${workingBook.isbn10}-L.jpg`
        : null);

  if (isbnCoverUrl) {
    workingBook = new BookEntity({
      ...workingBook.toJSON(),
      coverImageUrl: isbnCoverUrl,
    });
  }

  const lookupQuery = [workingBook.title, workingBook.author].filter(Boolean).join(" ").trim();

  try {
    const openLibraryMatches = await searchOpenLibrary(lookupQuery, 1);
    if (openLibraryMatches[0]) {
      const match = openLibraryMatches[0];
      const enriched = new BookEntity({
        ...workingBook.toJSON(),
        coverImageUrl: workingBook.coverImageUrl || match.coverImageUrl,
        genre: workingBook.genre || match.genre,
        description: workingBook.description || match.description,
        synopsis: workingBook.synopsis || match.synopsis,
        publishedAt: workingBook.publishedAt || match.publishedAt,
        averageRating: workingBook.averageRating ?? match.averageRating,
        ratingsCount: workingBook.ratingsCount ?? match.ratingsCount,
      });
      await persistEnrichedBookIfChanged(book, enriched);
      cacheSet(metadataCache, cacheKey, "book", enriched);
      return enriched;
    }
  } catch {
    // ignore and continue to Google fallback
  }

  try {
    const googleMatches = await searchGoogleBooks(lookupQuery, 1);
    if (googleMatches[0]) {
      const match = googleMatches[0];
      const enriched = new BookEntity({
        ...workingBook.toJSON(),
        coverImageUrl: workingBook.coverImageUrl || match.coverImageUrl,
        genre: workingBook.genre || match.genre,
        description: workingBook.description || match.description,
        synopsis: workingBook.synopsis || match.synopsis,
        publishedAt: workingBook.publishedAt || match.publishedAt,
        averageRating: workingBook.averageRating ?? match.averageRating,
        ratingsCount: workingBook.ratingsCount ?? match.ratingsCount,
      });
      await persistEnrichedBookIfChanged(book, enriched);
      cacheSet(metadataCache, cacheKey, "book", enriched);
      return enriched;
    }
  } catch {
    // ignore final fallback errors
  }

  cacheSet(metadataCache, cacheKey, "book", workingBook);
  return workingBook;
}

export async function searchBooksWithFallback(params: SearchFallbackParams, localBooks: Book[]): Promise<Book[]> {
  const cacheKey = getQueryCacheKey(params);
  const cached = cacheGet<Book[]>(queryCache, cacheKey, "books");
  if (cached) {
    return cached;
  }

  if (localBooks.length > 0 && hasStrongLocalMatch(params, localBooks)) {
    const enriched = await Promise.all(localBooks.map((book) => enrichBookFromExternalSources(book)));
    cacheSet(queryCache, cacheKey, "books", enriched);
    return enriched;
  }

  const fallbackQuery = [params.query, params.genre].filter(Boolean).join(" ").trim();
  if (!fallbackQuery) {
    cacheSet(queryCache, cacheKey, "books", []);
    return [];
  }

  try {
    const openLibraryBooks = await searchOpenLibrary(fallbackQuery, params.limit);
    if (openLibraryBooks.length > 0) {
      cacheSet(queryCache, cacheKey, "books", openLibraryBooks);
      return openLibraryBooks;
    }
  } catch {
    // continue to Google fallback
  }

  try {
    const googleBooks = await searchGoogleBooks(fallbackQuery, params.limit);
    if (googleBooks.length > 0) {
      cacheSet(queryCache, cacheKey, "books", googleBooks);
      return googleBooks;
    }
  } catch {
    // ignore and fall back to local results if they exist
  }

  if (localBooks.length > 0) {
    const enriched = await Promise.all(localBooks.map((book) => enrichBookFromExternalSources(book)));
    cacheSet(queryCache, cacheKey, "books", enriched);
    return enriched;
  }

  cacheSet(queryCache, cacheKey, "books", []);
  return [];
}
