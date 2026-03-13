const CLUB_BOOK_STATUSES = ["saved", "shortlisted", "current", "finished", "removed"] as const;

export type ClubBookStatus = (typeof CLUB_BOOK_STATUSES)[number];

type ClubBookInput = {
  id: string;
  clubId: string;
  userId: string;
  bookId: string;
  status?: ClubBookStatus;
  notes?: string;
  rating?: number | null;
  isCurrentRead?: boolean;
  addedAt?: Date | string;
};

type ClubBookRow = {
  id: string;
  club_id?: string;
  clubId?: string;
  user_id?: string;
  userId?: string;
  book_id?: string;
  bookId?: string;
  status?: ClubBookStatus;
  notes?: string | null;
  rating?: number | null;
  is_current_read?: boolean;
  isCurrentRead?: boolean;
  added_at?: Date | string;
  addedAt?: Date | string;
};

export class ClubBook {
  id: string;
  clubId: string;
  userId: string;
  bookId: string;
  status: ClubBookStatus;
  notes: string;
  rating: number | null;
  isCurrentRead: boolean;
  addedAt: Date;

  constructor({
    id,
    clubId,
    userId,
    bookId,
    status = "saved",
    notes = "",
    rating = null,
    isCurrentRead = false,
    addedAt = new Date(),
  }: ClubBookInput) {
    if (!id) {
      throw new Error("Club book id is required.");
    }

    if (!clubId || !userId || !bookId) {
      throw new Error("clubId, userId, and bookId are required for a club book.");
    }

    if (!CLUB_BOOK_STATUSES.includes(status)) {
      throw new Error(`Unsupported club book status: ${status}`);
    }

    if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 5)) {
      throw new Error("Club book rating must be between 0 and 5.");
    }

    this.id = String(id);
    this.clubId = String(clubId);
    this.userId = String(userId);
    this.bookId = String(bookId);
    this.status = status;
    this.notes = String(notes || "").trim();
    this.rating = rating === null ? null : Number(rating);
    this.isCurrentRead = Boolean(isCurrentRead);
    this.addedAt = addedAt instanceof Date ? addedAt : new Date(addedAt);
  }

  static fromDatabase(row: ClubBookRow): ClubBook {
    return new ClubBook({
      id: row.id,
      clubId: row.club_id ?? row.clubId ?? "",
      userId: row.user_id ?? row.userId ?? "",
      bookId: row.book_id ?? row.bookId ?? "",
      status: row.status ?? "saved",
      notes: row.notes ?? "",
      rating: row.rating ?? null,
      isCurrentRead: row.is_current_read ?? row.isCurrentRead ?? false,
      addedAt: row.added_at ?? row.addedAt ?? new Date(),
    });
  }

  toDatabase() {
    return {
      id: this.id,
      club_id: this.clubId,
      user_id: this.userId,
      book_id: this.bookId,
      status: this.status,
      notes: this.notes,
      rating: this.rating,
      is_current_read: this.isCurrentRead,
      added_at: this.addedAt,
    };
  }

  toJSON() {
    return {
      id: this.id,
      clubId: this.clubId,
      userId: this.userId,
      bookId: this.bookId,
      status: this.status,
      notes: this.notes,
      rating: this.rating,
      isCurrentRead: this.isCurrentRead,
      addedAt: this.addedAt,
    };
  }
}

export { CLUB_BOOK_STATUSES };
