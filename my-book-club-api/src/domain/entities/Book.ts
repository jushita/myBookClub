type BookInput = {
  id: string;
  externalId?: string | null;
  source?: string;
  workKey?: string | null;
  authorKeys?: string[];
  subjects?: string[];
  language?: string | null;
  title: string;
  author: string;
  genre?: string;
  description?: string;
  synopsis?: string;
  isbn10?: string | null;
  isbn13?: string | null;
  coverImageUrl?: string | null;
  publishedAt?: Date | string | null;
  pageCount?: number | null;
  averageRating?: number | null;
  ratingsCount?: number | null;
  embedding?: number[] | null;
  embeddingModel?: string | null;
  popularityScore?: number;
  createdAt?: Date | string;
};

type BookRow = {
  id: string;
  external_id?: string | null;
  externalId?: string | null;
  source?: string | null;
  work_key?: string | null;
  workKey?: string | null;
  author_keys?: string[] | null;
  authorKeys?: string[] | null;
  subjects?: string[] | null;
  language?: string | null;
  title: string;
  author: string;
  genre?: string | null;
  description?: string | null;
  synopsis?: string | null;
  isbn10?: string | null;
  isbn_10?: string | null;
  isbn13?: string | null;
  isbn_13?: string | null;
  cover_image_url?: string | null;
  coverImageUrl?: string | null;
  published_at?: Date | string | null;
  publishedAt?: Date | string | null;
  page_count?: number | null;
  pageCount?: number | null;
  average_rating?: number | null;
  averageRating?: number | null;
  ratings_count?: number | null;
  ratingsCount?: number | null;
  embedding?: number[] | null;
  embedding_vector?: number[] | string | null;
  embeddingVector?: number[] | string | null;
  embedding_model?: string | null;
  embeddingModel?: string | null;
  popularity_score?: number | null;
  popularityScore?: number | null;
  created_at?: Date | string;
  createdAt?: Date | string;
};

function parseEmbedding(value: number[] | string | null | undefined): number[] | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(Number);
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    return normalized
      .slice(1, -1)
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item));
  }

  return null;
}

export class Book {
  id: string;
  externalId: string | null;
  source: string;
  workKey: string | null;
  authorKeys: string[];
  subjects: string[];
  language: string | null;
  title: string;
  author: string;
  genre: string;
  description: string;
  synopsis: string;
  isbn10: string | null;
  isbn13: string | null;
  coverImageUrl: string | null;
  publishedAt: Date | null;
  pageCount: number | null;
  averageRating: number | null;
  ratingsCount: number | null;
  embedding: number[] | null;
  embeddingModel: string | null;
  popularityScore: number;
  createdAt: Date;

  constructor({
    id,
    externalId = null,
    source = "local",
    workKey = null,
    authorKeys = [],
    subjects = [],
    language = null,
    title,
    author,
    genre = "",
    description = "",
    synopsis = "",
    isbn10 = null,
    isbn13 = null,
    coverImageUrl = null,
    publishedAt = null,
    pageCount = null,
    averageRating = null,
    ratingsCount = null,
    embedding = null,
    embeddingModel = null,
    popularityScore = 0,
    createdAt = new Date(),
  }: BookInput) {
    if (!id) {
      throw new Error("Book id is required.");
    }

    if (!title || !String(title).trim()) {
      throw new Error("Book title is required.");
    }

    if (!author || !String(author).trim()) {
      throw new Error("Book author is required.");
    }

    this.id = String(id);
    this.externalId = externalId ? String(externalId) : null;
    this.source = String(source || "local").trim();
    this.workKey = workKey ? String(workKey) : null;
    this.authorKeys = Array.isArray(authorKeys) ? authorKeys.map(String).map((value) => value.trim()).filter(Boolean) : [];
    this.subjects = Array.isArray(subjects) ? subjects.map(String).map((value) => value.trim()).filter(Boolean) : [];
    this.language = language ? String(language).trim() : null;
    this.title = String(title).trim();
    this.author = String(author).trim();
    this.genre = String(genre || "").trim();
    this.description = String(description || "").trim();
    this.synopsis = String(synopsis || this.description).trim();
    this.isbn10 = isbn10 ? String(isbn10) : null;
    this.isbn13 = isbn13 ? String(isbn13) : null;
    this.coverImageUrl = coverImageUrl ? String(coverImageUrl) : null;
    this.publishedAt = publishedAt ? new Date(publishedAt) : null;
    this.pageCount = typeof pageCount === "number" && Number.isFinite(pageCount) ? pageCount : null;
    this.averageRating = typeof averageRating === "number" && Number.isFinite(averageRating) ? averageRating : null;
    this.ratingsCount = typeof ratingsCount === "number" && Number.isFinite(ratingsCount) ? ratingsCount : null;
    this.embedding = Array.isArray(embedding) ? embedding.map(Number) : null;
    this.embeddingModel = embeddingModel ? String(embeddingModel).trim() : null;
    this.popularityScore = Number.isFinite(popularityScore) ? Number(popularityScore) : 0;
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
  }

  static fromDatabase(row: BookRow): Book {
    return new Book({
      id: row.id,
      externalId: row.external_id ?? row.externalId ?? null,
      source: row.source ?? "local",
      workKey: row.work_key ?? row.workKey ?? null,
      authorKeys: row.author_keys ?? row.authorKeys ?? [],
      subjects: row.subjects ?? [],
      language: row.language ?? null,
      title: row.title,
      author: row.author,
      genre: row.genre ?? "",
      description: row.description ?? "",
      synopsis: row.synopsis ?? row.description ?? "",
      isbn10: row.isbn10 ?? row.isbn_10 ?? null,
      isbn13: row.isbn13 ?? row.isbn_13 ?? null,
      coverImageUrl: row.cover_image_url ?? row.coverImageUrl ?? null,
      publishedAt: row.published_at ?? row.publishedAt ?? null,
      pageCount: row.page_count ?? row.pageCount ?? null,
      averageRating: row.average_rating ?? row.averageRating ?? null,
      ratingsCount: row.ratings_count ?? row.ratingsCount ?? null,
      embedding: parseEmbedding(row.embedding_vector ?? row.embeddingVector ?? row.embedding ?? null),
      embeddingModel: row.embedding_model ?? row.embeddingModel ?? null,
      popularityScore: row.popularity_score ?? row.popularityScore ?? 0,
      createdAt: row.created_at ?? row.createdAt ?? new Date(),
    });
  }

  toDatabase() {
    return {
      id: this.id,
      external_id: this.externalId,
      source: this.source,
      work_key: this.workKey,
      author_keys: this.authorKeys,
      subjects: this.subjects,
      language: this.language,
      title: this.title,
      author: this.author,
      genre: this.genre,
      description: this.description,
      synopsis: this.synopsis,
      isbn_10: this.isbn10,
      isbn_13: this.isbn13,
      cover_image_url: this.coverImageUrl,
      published_at: this.publishedAt,
      page_count: this.pageCount,
      average_rating: this.averageRating,
      ratings_count: this.ratingsCount,
      embedding: this.embedding,
      embedding_model: this.embeddingModel,
      popularity_score: this.popularityScore,
      created_at: this.createdAt,
    };
  }

  toJSON() {
    return {
      id: this.id,
      externalId: this.externalId,
      source: this.source,
      workKey: this.workKey,
      authorKeys: this.authorKeys,
      subjects: this.subjects,
      language: this.language,
      title: this.title,
      author: this.author,
      genre: this.genre,
      description: this.description,
      synopsis: this.synopsis,
      isbn10: this.isbn10,
      isbn13: this.isbn13,
      coverImageUrl: this.coverImageUrl,
      publishedAt: this.publishedAt,
      pageCount: this.pageCount,
      averageRating: this.averageRating,
      ratingsCount: this.ratingsCount,
      embedding: this.embedding,
      embeddingModel: this.embeddingModel,
      popularityScore: this.popularityScore,
      createdAt: this.createdAt,
    };
  }

  toPublicJSON() {
    return {
      id: this.id,
      externalId: this.externalId,
      source: this.source,
      workKey: this.workKey,
      authorKeys: this.authorKeys,
      subjects: this.subjects,
      language: this.language,
      title: this.title,
      author: this.author,
      genre: this.genre,
      description: this.description,
      synopsis: this.synopsis,
      isbn10: this.isbn10,
      isbn13: this.isbn13,
      coverImageUrl: this.coverImageUrl,
      publishedAt: this.publishedAt,
      pageCount: this.pageCount,
      averageRating: this.averageRating,
      ratingsCount: this.ratingsCount,
      popularityScore: this.popularityScore,
      createdAt: this.createdAt,
    };
  }
}
