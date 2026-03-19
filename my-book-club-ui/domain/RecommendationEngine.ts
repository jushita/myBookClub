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

  buildPersonalizedRecommendations(
    catalog: Book[],
    options: {
      savedBooks: Book[];
      finishedBooks: Book[];
      currentBook?: Book | null;
      club?: Club;
      limit?: number;
      rotationSeed?: number;
    }
  ): Recommendation[] {
    const { savedBooks, finishedBooks, currentBook, club, limit = 3, rotationSeed = 0 } = options;
    const signals = [...savedBooks, ...finishedBooks, ...(currentBook ? [currentBook] : [])];
    const excludedKeys = new Set(signals.map((book) => this.getLookupKey(book)));
    const genreWeights = new Map<string, number>();
    const tokenWeights = new Map<string, number>();

    for (const book of signals) {
      const genre = book.genre.trim().toLowerCase();
      if (genre) {
        genreWeights.set(genre, (genreWeights.get(genre) ?? 0) + 3);
      }

      for (const token of this.tokenize([book.title, book.author, book.genre, book.description, book.note].join(" "))) {
        tokenWeights.set(token, (tokenWeights.get(token) ?? 0) + 1);
      }
    }

    const clubTokens = this.tokenize(`${club?.vibe || ""} ${club?.description || ""} ${club?.promptSeed || ""}`);
    for (const token of clubTokens) {
      tokenWeights.set(token, (tokenWeights.get(token) ?? 0) + 1);
    }

    const scored = catalog
      .filter((book) => !excludedKeys.has(this.getLookupKey(book)))
      .map((book) => {
        const genre = book.genre.trim().toLowerCase();
        const haystackTokens = this.tokenize([book.title, book.author, book.genre, book.description, book.note].join(" "));
        let score = 0;

        if (genre && genreWeights.has(genre)) {
          score += genreWeights.get(genre) ?? 0;
        }

        for (const token of haystackTokens) {
          score += tokenWeights.get(token) ?? 0;
        }

        if (currentBook) {
          if (genre && genre === currentBook.genre.trim().toLowerCase()) {
            score += 4;
          }

          if (book.author.trim().toLowerCase() === currentBook.author.trim().toLowerCase()) {
            score += 2;
          }
        }

        if (club?.vibe && haystackTokens.some((token) => club.vibe.toLowerCase().includes(token))) {
          score += 2;
        }

        return {
          book,
          score,
        };
      });

    const rankedPrimary = scored
      .filter((item) => item.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return this.computeRotationScore(right.book, rotationSeed) - this.computeRotationScore(left.book, rotationSeed);
      })
      .slice(0, limit);

    const usedAuthors = new Set(rankedPrimary.map(({ book }) => book.author.trim().toLowerCase()));
    const usedIds = new Set(rankedPrimary.map(({ book }) => book.id));
    const rankedFallback = scored
      .filter(({ book }) => !usedIds.has(book.id))
      .sort((left, right) => this.computeRotationScore(right.book, rotationSeed) - this.computeRotationScore(left.book, rotationSeed))
      .filter(({ book }) => {
        const authorKey = book.author.trim().toLowerCase();
        if (usedAuthors.has(authorKey) && usedAuthors.size < limit) {
          return false;
        }

        usedAuthors.add(authorKey);
        return true;
      })
      .slice(0, Math.max(limit - rankedPrimary.length, 0));

    return [...rankedPrimary, ...rankedFallback]
      .slice(0, limit)
      .map(({ book }) => ({
        ...book,
        matchReason: this.buildPersonalizedReason(book, currentBook, club),
      }));
  }

  private getLookupKey(book: Pick<Book, "title" | "author">) {
    return `${book.title.trim().toLowerCase()}::${book.author.trim().toLowerCase()}`;
  }

  private tokenize(value: string): string[] {
    return value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4);
  }

  private buildPersonalizedReason(book: Book, currentBook?: Book | null, club?: Club): string {
    if (currentBook && book.genre.trim().toLowerCase() === currentBook.genre.trim().toLowerCase()) {
      return `You keep circling ${book.genre.toLowerCase()} picks, and this one fits the same lane as ${currentBook.title}.`;
    }

    if (club?.vibe) {
      return `This lines up with your shelf and the ${club.vibe.toLowerCase()} energy of ${club.name}.`;
    }

    return "Picked from the patterns in your saved and finished books.";
  }

  private computeRotationScore(book: Book, rotationSeed: number): number {
    const key = `${this.getLookupKey(book)}::${rotationSeed}`;
    let hash = 0;

    for (let index = 0; index < key.length; index += 1) {
      hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
    }

    return hash;
  }
}
