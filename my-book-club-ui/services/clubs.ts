import type { Book, Club, ClubMember } from "../types";
import { apiBaseUrl, requestJson } from "./http";

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

function toBook(apiBook: ApiBook): Book {
  return {
    id: apiBook.id,
    title: apiBook.title,
    author: apiBook.author,
    genre: apiBook.genre,
    note: apiBook.synopsis || apiBook.description || "Saved from the club library.",
  };
}

export async function fetchUserClubs(userId: string): Promise<Club[]> {
  const data = await requestJson<{ clubs: ApiClub[] }>(`${apiBaseUrl}/api/clubs?userId=${encodeURIComponent(userId)}`);
  return data.clubs.map(toClub);
}

export async function fetchAllClubs(): Promise<Club[]> {
  const data = await requestJson<{ clubs: ApiClub[] }>(`${apiBaseUrl}/api/clubs`);
  return data.clubs.map(toClub);
}

export async function fetchClubMembers(clubId: string): Promise<ClubMember[]> {
  const data = await requestJson<{ members: ApiClubMember[] }>(
    `${apiBaseUrl}/api/clubs/${encodeURIComponent(clubId)}/members`
  );

  return data.members.map((member) => ({
    id: member.id,
    userId: member.userId,
    name: member.user?.name || "Member",
    role: member.role,
  }));
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
}

export async function fetchClubBooks(clubId: string): Promise<{ books: Book[]; currentBookTitle: string | null }> {
  const data = await requestJson<{ clubBooks: ApiClubBook[] }>(
    `${apiBaseUrl}/api/clubs/${encodeURIComponent(clubId)}/books`
  );

  const books = data.clubBooks
    .map((entry) => (entry.book ? toBook(entry.book) : null))
    .filter((entry): entry is Book => Boolean(entry));

  const currentBookTitle =
    data.clubBooks.find((entry) => entry.isCurrentRead)?.book?.title ||
    data.clubBooks.find((entry) => entry.status === "current")?.book?.title ||
    books[0]?.title ||
    null;

  return {
    books,
    currentBookTitle,
  };
}

export async function saveBookToClub(
  clubId: string,
  userId: string,
  book: Pick<Book, "id" | "title" | "author" | "genre" | "note">
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
        status: "saved",
      }),
    }
  );

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

  if (!data.clubBook.book) {
    throw new Error("Club book response did not include a book.");
  }

  return toBook(data.clubBook.book);
}
