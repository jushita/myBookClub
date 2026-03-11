export type ClubMember = {
  id: string;
  name: string;
};

export type AuthProvider = "google" | "facebook" | "email";

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
