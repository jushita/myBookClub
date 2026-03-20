import type { Animated } from "react-native";
import type {
  AuthUser,
  Book,
  Club,
  ClubLibraryEntry,
  ClubMember,
  Recommendation,
} from "../types";
import { WheelEngine } from "../domain/WheelEngine";
import type { ClubInsight } from "../services/clubs";

export function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: overrides.id ?? "book-1",
    title: overrides.title ?? "Gone Girl",
    author: overrides.author ?? "Gillian Flynn",
    genre: overrides.genre ?? "Psychological thriller",
    note: overrides.note ?? "Dark and twisty.",
    description: overrides.description ?? "A sharp psychological thriller about marriage and media.",
    coverImageUrl: overrides.coverImageUrl ?? "https://example.com/book.jpg",
    synopsis: overrides.synopsis,
    averageRating: overrides.averageRating ?? null,
    ratingsCount: overrides.ratingsCount ?? null,
  };
}

export function makeRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    ...makeBook(overrides),
    matchReason: overrides.matchReason ?? "Strong fit for the club.",
  };
}

export function makeClub(overrides: Partial<Club> = {}): Club {
  return {
    id: overrides.id ?? "club-1",
    name: overrides.name ?? "Midnight Readers",
    vibe: overrides.vibe ?? "Atmospheric thrillers",
    description: overrides.description,
    promptSeed: overrides.promptSeed ?? "Dark page-turners",
    memberIds: overrides.memberIds,
  };
}

export function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: overrides.id ?? "user-1",
    name: overrides.name ?? "Jushita",
    email: overrides.email ?? "jushita@example.com",
    provider: overrides.provider ?? "email",
  };
}

export function makeClubMember(overrides: Partial<ClubMember> = {}): ClubMember {
  return {
    id: overrides.id ?? "member-1",
    userId: overrides.userId,
    name: overrides.name ?? "Ava",
    role: overrides.role,
  };
}

export function makeLibraryEntry(overrides: Partial<ClubLibraryEntry> = {}): ClubLibraryEntry {
  const book = overrides.book ?? makeBook();
  return {
    id: overrides.id ?? `entry-${book.id}`,
    userId: overrides.userId ?? "user-1",
    clubId: overrides.clubId ?? "club-1",
    bookId: overrides.bookId ?? book.id,
    status: overrides.status ?? "saved",
    isCurrentRead: overrides.isCurrentRead ?? false,
    addedAt: overrides.addedAt,
    book,
  };
}

export function makeClubInsight(overrides: Partial<ClubInsight> = {}): ClubInsight {
  return {
    headline: overrides.headline ?? "Unreliable narrators, high tension",
    summary: overrides.summary ?? "Your shelf leans dark, twisty, and emotionally sharp.",
    source: overrides.source ?? "fallback",
  };
}

export function makeWheelEngine() {
  return new WheelEngine();
}

export function makeAnimatedRotation() {
  return "0deg" as unknown as Animated.AnimatedInterpolation<string>;
}
