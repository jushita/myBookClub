export type ClubMember = {
  id: string;
  userId?: string;
  name: string;
  role?: "owner" | "admin" | "member";
};

export type Club = {
  id: string;
  name: string;
  vibe: string;
  description?: string;
  promptSeed: string;
  memberIds?: string[];
};

export type AuthProvider = "google" | "email";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  provider: AuthProvider;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  genre: string;
  note: string;
  description?: string;
  coverImageUrl?: string | null;
  synopsis?: string;
  averageRating?: number | null;
  ratingsCount?: number | null;
};

export type ClubBookStatus = "saved" | "shortlisted" | "current" | "finished" | "removed";

export type ClubLibraryEntry = {
  id: string;
  userId: string;
  clubId: string;
  bookId: string;
  status: ClubBookStatus;
  isCurrentRead: boolean;
  addedAt?: string;
  book: Book;
};

export type Recommendation = Book & {
  matchReason: string;
};

export type RecommendationResult = {
  recommendations: Recommendation[];
  explanation: string;
  source: "ollama" | "fallback" | "local";
  query?: string;
};
