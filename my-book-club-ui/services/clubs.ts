import type { Book, Club, ClubBookStatus, ClubLibraryEntry, ClubMember } from "../types";
import { getBookCoverUrl } from "../data/bookCoverFallbacks";
import { normalizeGenreLabel, pickDisplaySummary } from "./bookPresentation";
import { apiBaseUrl, requestJson } from "./http";

const CACHE_VERSION = "v4";
const CACHE_TTL_MS = 30_000;
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();

type ApiClub = {
  id: string;
  name: string;
  description?: string;
  vibe?: string;
};

type ApiClubMember = {
  id: string;
  userId: string;
  role: "owner" | "admin" | "member";
  user?: {
    id: string;
    name: string;
    email: string;
    provider: "google" | "email";
  } | null;
};

type ApiBook = {
  id: string;
  title: string;
  author: string;
  genre: string;
  description?: string;
  synopsis?: string;
  coverImageUrl?: string | null;
};

type ApiClubBook = {
  id: string;
  clubId: string;
  userId: string;
  bookId: string;
  status: "saved" | "shortlisted" | "current" | "finished" | "removed";
  notes?: string;
  rating?: number | null;
  isCurrentRead: boolean;
  book: ApiBook | null;
};

type DiscussionQuestionsResponse = {
  currentBookId: string | null;
  questions: string[];
};

type ClubInsightResponse = {
  insight: {
    headline: string;
    summary: string;
    source: "ollama" | "fallback";
  };
};

export type ClubInsight = {
  headline: string;
  summary: string;
  source: "ollama" | "fallback";
};

function normalizeInsightText(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => normalizeInsightText(item, ""))
      .filter(Boolean)
      .join(", ")
      .trim();
    return joined || fallback;
  }

  if (value && typeof value === "object") {
    const objectText = Object.values(value as Record<string, unknown>)
      .map((item) => normalizeInsightText(item, ""))
      .filter(Boolean)
      .join(" ")
      .trim();
    return objectText || fallback;
  }

  if (value == null) {
    return fallback;
  }

  const text = String(value).trim();
  if (!text || text === "[object Object]") {
    return fallback;
  }

  return text.replace(/\[object Object\]/g, "").replace(/\s{2,}/g, " ").trim() || fallback;
}

function toClub(apiClub: ApiClub): Club {
  const description = apiClub.description || "";
  const vibe = apiClub.vibe || "Book club mood";

  return {
    id: apiClub.id,
    name: apiClub.name,
    vibe,
    description,
    promptSeed: `${apiClub.name}. ${description} ${vibe}`.trim(),
  };
}

async function readThroughCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const value = await loader();
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return value;
}

function peekCacheValue<T>(key: string): T | null {
  const cached = responseCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    if (cached) {
      responseCache.delete(key);
    }
    return null;
  }

  return cached.value as T;
}

function invalidateCache(prefixes: string[]) {
  for (const key of responseCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      responseCache.delete(key);
    }
  }
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
  };
}

function toClubLibraryEntry(apiClubBook: ApiClubBook): ClubLibraryEntry | null {
  if (!apiClubBook.book) {
    return null;
  }

  return {
    id: apiClubBook.id,
    clubId: apiClubBook.clubId,
    userId: apiClubBook.userId,
    bookId: apiClubBook.bookId,
    status: apiClubBook.status,
    isCurrentRead: apiClubBook.isCurrentRead,
    addedAt: undefined,
    book: toBook(apiClubBook.book),
  };
}

export async function fetchUserClubs(userId: string): Promise<Club[]> {
  const cacheKey = `${CACHE_VERSION}:clubs:user:${userId}`;
  return readThroughCache(cacheKey, async () => {
    const data = await requestJson<{ clubs: ApiClub[] }>(`${apiBaseUrl}/api/clubs?userId=${encodeURIComponent(userId)}`);
    return data.clubs.map(toClub);
  });
}

export async function fetchAllClubs(): Promise<Club[]> {
  return readThroughCache(`${CACHE_VERSION}:clubs:all`, async () => {
    const data = await requestJson<{ clubs: ApiClub[] }>(`${apiBaseUrl}/api/clubs`);
    return data.clubs.map(toClub);
  });
}

export async function fetchClubMembers(clubId: string): Promise<ClubMember[]> {
  const cacheKey = `${CACHE_VERSION}:clubs:${clubId}:members`;
  return readThroughCache(cacheKey, async () => {
    const data = await requestJson<{ members: ApiClubMember[] }>(
      `${apiBaseUrl}/api/clubs/${encodeURIComponent(clubId)}/members`
    );

    return data.members.map((member) => ({
      id: member.id,
      userId: member.userId,
      name: member.user?.name || "Member",
      role: member.role,
    }));
  });
}

export async function createClubForUser(input: {
  createdByUserId: string;
  name: string;
  description: string;
  vibe: string;
}): Promise<Club> {
  const data = await requestJson<{ club: ApiClub }>(`${apiBaseUrl}/api/clubs`, {
    method: "POST",
    body: JSON.stringify(input),
  });

  invalidateCache([`${CACHE_VERSION}:clubs:all`, `${CACHE_VERSION}:clubs:user:${input.createdByUserId}`]);

  return toClub(data.club);
}

export async function joinClubForUser(clubId: string, userId: string): Promise<void> {
  await requestJson(`${apiBaseUrl}/api/clubs/${encodeURIComponent(clubId)}/members`, {
    method: "POST",
    body: JSON.stringify({
      userId,
      role: "member",
    }),
  });
  invalidateCache([
    `${CACHE_VERSION}:clubs:all`,
    `${CACHE_VERSION}:clubs:user:${userId}`,
    `${CACHE_VERSION}:clubs:${clubId}:members`,
  ]);
}

export async function fetchClubBooks(
  clubId: string,
  userId?: string,
  status?: ClubBookStatus
): Promise<{ entries: ClubLibraryEntry[]; books: Book[]; currentBookTitle: string | null }> {
  const params = new URLSearchParams();
  if (userId) {
    params.set("userId", userId);
  }
  if (status) {
    params.set("status", status);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const cacheKey = `${CACHE_VERSION}:clubs:${clubId}:books:user:${userId || "all"}:status:${status || "all"}`;
  return readThroughCache(cacheKey, async () => {
    const data = await requestJson<{ clubBooks: ApiClubBook[] }>(
      `${apiBaseUrl}/api/clubs/${encodeURIComponent(clubId)}/books${query}`
    );

    const entries = data.clubBooks.map(toClubLibraryEntry).filter((entry): entry is ClubLibraryEntry => Boolean(entry));
    const books = Array.from(new Map(entries.map((entry) => [entry.book.id, entry.book])).values());

    const currentBookTitle =
      data.clubBooks.find((entry) => entry.isCurrentRead)?.book?.title ||
      data.clubBooks.find((entry) => entry.status === "current")?.book?.title ||
      books[0]?.title ||
      null;

    return {
      entries,
      books,
      currentBookTitle,
    };
  });
}

export async function fetchCurrentClubDiscussionQuestions(
  clubId: string
): Promise<{ currentBookId: string | null; questions: string[] }> {
  const cacheKey = `${CACHE_VERSION}:clubs:${clubId}:discussion:current`;
  return readThroughCache(cacheKey, async () => {
    const data = await requestJson<DiscussionQuestionsResponse>(
      `${apiBaseUrl}/api/clubs/${encodeURIComponent(clubId)}/discussion/current`
    );

    return {
      currentBookId: data.currentBookId ?? null,
      questions: Array.isArray(data.questions)
        ? data.questions.map((question) => String(question).trim()).filter(Boolean).slice(0, 5)
        : [],
    };
  });
}

export function getCachedCurrentClubDiscussionQuestions(
  clubId: string
): { currentBookId: string | null; questions: string[] } | null {
  return peekCacheValue<{ currentBookId: string | null; questions: string[] }>(
    `${CACHE_VERSION}:clubs:${clubId}:discussion:current`
  );
}

export async function fetchClubInsight(clubId: string): Promise<ClubInsight> {
  const cacheKey = `${CACHE_VERSION}:clubs:${clubId}:insights`;
  return readThroughCache(cacheKey, async () => {
    const data = await requestJson<ClubInsightResponse>(
      `${apiBaseUrl}/api/clubs/${encodeURIComponent(clubId)}/insights`
    );

    return {
      headline: normalizeInsightText(data.insight?.headline, "Club taste snapshot"),
      summary: normalizeInsightText(data.insight?.summary, "The club insight is still warming up."),
      source: data.insight?.source === "ollama" ? "ollama" : "fallback",
    };
  });
}

export function getCachedClubInsight(clubId: string): ClubInsight | null {
  return peekCacheValue<ClubInsight>(`${CACHE_VERSION}:clubs:${clubId}:insights`);
}

export async function saveBookToClub(
  clubId: string,
  userId: string,
  book: Pick<Book, "id" | "title" | "author" | "genre" | "note" | "coverImageUrl">
): Promise<Book> {
  const data = await requestJson<{ clubBook: { book: ApiBook | null } }>(
    `${apiBaseUrl}/api/clubs/${encodeURIComponent(clubId)}/books`,
    {
      method: "POST",
      body: JSON.stringify({
        userId,
        bookId: book.id,
        title: book.title,
        author: book.author,
        genre: book.genre,
        description: book.note,
        synopsis: book.note,
        coverImageUrl: book.coverImageUrl ?? null,
        status: "saved",
      }),
    }
  );

  invalidateCache([
    `${CACHE_VERSION}:clubs:${clubId}:books:`,
    `${CACHE_VERSION}:clubs:${clubId}:insights`,
    `${CACHE_VERSION}:clubs:${clubId}:members`,
    `${CACHE_VERSION}:clubs:${clubId}:discussion:`,
    `${CACHE_VERSION}:clubs:user:${userId}`,
  ]);

  if (!data.clubBook.book) {
    throw new Error("Club book response did not include a book.");
  }

  return toBook(data.clubBook.book);
}

export async function saveSampleBookToClub(clubId: string, userId: string): Promise<Book> {
  const data = await requestJson<{ clubBook: { book: ApiBook | null } }>(
    `${apiBaseUrl}/api/clubs/${encodeURIComponent(clubId)}/books`,
    {
      method: "POST",
      body: JSON.stringify({
        userId,
        title: "The House in the Cerulean Sea",
        author: "TJ Klune",
        genre: "Fantasy",
        description: "Warm character-driven pick for the club shortlist.",
        synopsis: "Warm character-driven pick for the club shortlist.",
        status: "saved",
      }),
    }
  );

  invalidateCache([
    `${CACHE_VERSION}:clubs:${clubId}:books:`,
    `${CACHE_VERSION}:clubs:${clubId}:insights`,
    `${CACHE_VERSION}:clubs:${clubId}:members`,
    `${CACHE_VERSION}:clubs:${clubId}:discussion:`,
    `${CACHE_VERSION}:clubs:user:${userId}`,
  ]);

  if (!data.clubBook.book) {
    throw new Error("Club book response did not include a book.");
  }

  return toBook(data.clubBook.book);
}

export async function removeBookFromClub(clubId: string, userId: string, bookId: string): Promise<void> {
  await requestJson(`${apiBaseUrl}/api/clubs/${encodeURIComponent(clubId)}/users/${encodeURIComponent(userId)}/books/${encodeURIComponent(bookId)}`, {
    method: "DELETE",
  });
  invalidateCache([
    `${CACHE_VERSION}:clubs:${clubId}:books:`,
    `${CACHE_VERSION}:clubs:${clubId}:insights`,
    `${CACHE_VERSION}:clubs:${clubId}:members`,
    `${CACHE_VERSION}:clubs:${clubId}:discussion:`,
    `${CACHE_VERSION}:clubs:user:${userId}`,
  ]);
}

export async function updateClubBookEntry(
  clubId: string,
  userId: string,
  bookId: string,
  updates: { status?: ClubBookStatus; isCurrentRead?: boolean }
): Promise<ClubLibraryEntry> {
  const data = await requestJson<{ clubBook: ApiClubBook }>(
    `${apiBaseUrl}/api/clubs/${encodeURIComponent(clubId)}/users/${encodeURIComponent(userId)}/books/${encodeURIComponent(bookId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(updates),
    }
  );

  invalidateCache([
    `${CACHE_VERSION}:clubs:${clubId}:books:`,
    `${CACHE_VERSION}:clubs:${clubId}:insights`,
    `${CACHE_VERSION}:clubs:${clubId}:members`,
    `${CACHE_VERSION}:clubs:${clubId}:discussion:`,
    `${CACHE_VERSION}:clubs:user:${userId}`,
  ]);

  const entry = toClubLibraryEntry(data.clubBook);

  if (!entry) {
    throw new Error("Club book response did not include a book.");
  }

  return entry;
}

export async function updateClubBookStatus(
  clubId: string,
  userId: string,
  bookId: string,
  status: ClubBookStatus
): Promise<ClubLibraryEntry> {
  return updateClubBookEntry(clubId, userId, bookId, { status });
}
