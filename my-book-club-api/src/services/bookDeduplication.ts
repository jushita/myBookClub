type BookLike = {
  id?: unknown;
  title?: unknown;
  author?: unknown;
  coverImageUrl?: unknown;
  description?: unknown;
  synopsis?: unknown;
  genre?: unknown;
  publishedAt?: unknown;
  averageRating?: unknown;
  ratingsCount?: unknown;
  popularityScore?: unknown;
};

function normalizeText(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isKnownAuthor(value: unknown): boolean {
  const normalized = normalizeText(value);
  return Boolean(normalized) && normalized !== "unknown author" && normalized !== "unknown";
}

function textLength(value: unknown): number {
  return String(value || "").trim().length;
}

function getBookDescriptionLength(book: BookLike): number {
  return Math.max(textLength(book.synopsis), textLength(book.description));
}

function getBookCompletenessScore(book: BookLike): number {
  let score = 0;

  if (String(book.coverImageUrl || "").trim()) {
    score += 10;
  }

  if (isKnownAuthor(book.author)) {
    score += 8;
  }

  const descriptionLength = getBookDescriptionLength(book);
  if (descriptionLength > 0) {
    score += 8;
    score += Math.min(descriptionLength, 240) / 40;
  }

  if (String(book.genre || "").trim()) {
    score += 2;
  }

  if (book.publishedAt) {
    score += 1;
  }

  if (typeof book.averageRating === "number" && Number.isFinite(book.averageRating)) {
    score += 1;
  }

  if (typeof book.ratingsCount === "number" && Number.isFinite(book.ratingsCount) && book.ratingsCount > 0) {
    score += 1;
  }

  if (typeof book.popularityScore === "number" && Number.isFinite(book.popularityScore)) {
    score += Math.min(book.popularityScore, 10_000) / 10_000;
  }

  return score;
}

function choosePreferredBook<T extends BookLike>(left: T, right: T): T {
  const leftScore = getBookCompletenessScore(left);
  const rightScore = getBookCompletenessScore(right);

  if (rightScore > leftScore) {
    return right;
  }

  if (leftScore > rightScore) {
    return left;
  }

  const leftDescriptionLength = getBookDescriptionLength(left);
  const rightDescriptionLength = getBookDescriptionLength(right);
  if (rightDescriptionLength > leftDescriptionLength) {
    return right;
  }

  if (leftDescriptionLength > rightDescriptionLength) {
    return left;
  }

  const leftId = String(left.id || "");
  const rightId = String(right.id || "");
  return leftId <= rightId ? left : right;
}

export function dedupeBooksByCompleteness<T extends BookLike>(books: T[]): T[] {
  const groupedByTitle = new Map<string, Array<{ book: T; index: number }>>();
  const passthrough: Array<{ book: T; index: number }> = [];

  books.forEach((book, index) => {
    const titleKey = normalizeText(book.title);
    if (!titleKey) {
      passthrough.push({ book, index });
      return;
    }

    const existing = groupedByTitle.get(titleKey);
    if (existing) {
      existing.push({ book, index });
    } else {
      groupedByTitle.set(titleKey, [{ book, index }]);
    }
  });

  const selected: Array<{ book: T; index: number }> = [...passthrough];

  for (const entries of groupedByTitle.values()) {
    const knownAuthorGroups = new Map<string, Array<{ book: T; index: number }>>();
    const unknownAuthorEntries: Array<{ book: T; index: number }> = [];

    for (const entry of entries) {
      if (isKnownAuthor(entry.book.author)) {
        const authorKey = normalizeText(entry.book.author);
        const authorEntries = knownAuthorGroups.get(authorKey);
        if (authorEntries) {
          authorEntries.push(entry);
        } else {
          knownAuthorGroups.set(authorKey, [entry]);
        }
      } else {
        unknownAuthorEntries.push(entry);
      }
    }

    if (knownAuthorGroups.size <= 1) {
      const mergedEntries = [...entries];
      const best = mergedEntries.reduce((current, candidate) => choosePreferredBook(current, candidate.book), mergedEntries[0].book);
      selected.push({
        book: best,
        index: Math.min(...mergedEntries.map((entry) => entry.index)),
      });
      continue;
    }

    for (const authorEntries of knownAuthorGroups.values()) {
      const best = authorEntries.reduce((current, candidate) => choosePreferredBook(current, candidate.book), authorEntries[0].book);
      selected.push({
        book: best,
        index: Math.min(...authorEntries.map((entry) => entry.index)),
      });
    }

    if (knownAuthorGroups.size === 0 && unknownAuthorEntries.length > 0) {
      const best = unknownAuthorEntries.reduce((current, candidate) => choosePreferredBook(current, candidate.book), unknownAuthorEntries[0].book);
      selected.push({
        book: best,
        index: Math.min(...unknownAuthorEntries.map((entry) => entry.index)),
      });
    }
  }

  return selected
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.book);
}
