import type { Book, Club, Recommendation } from "../types";

export class RecommendationEngine {
  constructor(private readonly baseRecommendations: Recommendation[]) {}

  buildClubRecommendations(query: string, club?: Club): Recommendation[] {
    const normalized = query.toLowerCase();

    return this.baseRecommendations.map((item) => ({
      ...item,
      matchReason: normalized.includes("mystery")
        ? `${item.matchReason} ${club?.name || "This club"} also leans into ${club?.vibe.toLowerCase() || "layered"} picks.`
        : `${item.matchReason} This fits the ${club?.vibe.toLowerCase() || "current"} club mood.`,
    }));
  }

  buildAiRecommendations(prompt: string, club?: Club): Recommendation[] {
    const normalized = prompt.toLowerCase();

    return this.baseRecommendations.map((item) => ({
      ...item,
      matchReason: prompt.trim()
        ? normalized.includes("mystery")
          ? `${item.matchReason} It also aligns with the request for ${prompt.trim().toLowerCase()}.`
          : `${item.matchReason} It fits the request for ${prompt.trim().toLowerCase()}.`
        : `${item.matchReason} It pulls from ${club?.name || "the club"} taste and the ${club?.vibe.toLowerCase() || "current"} mood.`,
    }));
  }

  mergeCatalog(guestBooks: Book[], favoriteBooks: Book[], recommendations: Recommendation[]): Book[] {
    const merged = [...guestBooks, ...favoriteBooks, ...recommendations];
    const seen = new Set<string>();

    return merged.filter((book) => {
      if (seen.has(book.id)) {
        return false;
      }

      seen.add(book.id);
      return true;
    });
  }

  filterCatalog(catalog: Book[], searchTerm: string): Book[] {
    const normalized = searchTerm.trim().toLowerCase();

    if (!normalized) {
      return catalog;
    }

    return catalog.filter((book) =>
      [book.title, book.author, book.genre, book.note].some((value) =>
        value.toLowerCase().includes(normalized)
      )
    );
  }
}
