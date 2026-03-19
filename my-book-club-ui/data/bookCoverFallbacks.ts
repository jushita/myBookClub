import type { Book } from "../types";

const COVER_FALLBACKS: Record<string, string> = {
  "the maid::nita prose": "https://covers.openlibrary.org/b/isbn/9780593356159-L.jpg",
  "gone girl::gillian flynn": "https://covers.openlibrary.org/b/isbn/9780307588371-L.jpg",
  "the exorcist::william peter blatty": "https://covers.openlibrary.org/b/isbn/9780061007224-L.jpg",
  "seed::ania ahlborn": "https://covers.openlibrary.org/b/isbn/9781476783734-L.jpg",
  "the house in the cerulean sea::tj klune": "https://covers.openlibrary.org/b/isbn/9781250217288-L.jpg",
  "rebecca::daphne du maurier": "https://covers.openlibrary.org/b/isbn/9780380730407-L.jpg",
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function getBookCoverUrl(book: Pick<Book, "title" | "author"> & { coverImageUrl?: string | null }): string | null {
  if (book.coverImageUrl) {
    return book.coverImageUrl;
  }

  return COVER_FALLBACKS[`${normalize(book.title)}::${normalize(book.author)}`] ?? null;
}
