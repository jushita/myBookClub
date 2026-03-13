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
};

export type Recommendation = Book & {
  matchReason: string;
};
