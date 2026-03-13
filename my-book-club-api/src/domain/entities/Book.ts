type BookInput = {
  id: string;
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
  embedding?: number[] | null;
  createdAt?: Date | string;
};

type BookRow = {
  id: string;
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
  embedding?: number[] | null;
  created_at?: Date | string;
  createdAt?: Date | string;
};

export class Book {
  id: string;
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
  embedding: number[] | null;
  createdAt: Date;

  constructor({
    id,
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
    embedding = null,
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
    this.embedding = Array.isArray(embedding) ? embedding.map(Number) : null;
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
  }

  static fromDatabase(row: BookRow): Book {
    return new Book({
      id: row.id,
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
      embedding: row.embedding ?? null,
      createdAt: row.created_at ?? row.createdAt ?? new Date(),
    });
  }

  toDatabase() {
    return {
      id: this.id,
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
      embedding: this.embedding,
      created_at: this.createdAt,
    };
  }

  toJSON() {
    return {
      id: this.id,
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
      embedding: this.embedding,
      createdAt: this.createdAt,
    };
  }
}
