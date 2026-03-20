import { Router } from "express";
import type { Request, Response } from "express";
import { Book, Club, ClubBook, ClubMember } from "../domain/entities/index.js";
import { listBooksByIds, createBook, findBookById } from "../repositories/books.js";
import {
  addClubBook,
  findCurrentClubBook,
  removeClubBook,
  findClubBook,
  listClubBooksByClubAndUser,
  listClubBooksByClubId,
  promoteClubBookToCurrent,
  updateClubBook,
} from "../repositories/clubBooks.js";
import {
  findDiscussionQuestionsForClubBook,
  upsertDiscussionQuestionsForClubBook,
} from "../repositories/clubDiscussionQuestions.js";
import { findClubInsight, upsertClubInsight } from "../repositories/clubInsights.js";
import {
  addClubMember,
  findClubMember,
  listMembersByClubId,
  removeClubMember,
  updateClubMemberRole,
} from "../repositories/clubMembers.js";
import {
  createClub,
  deleteClub,
  findClubById,
  listClubs,
  listClubsForUser,
  updateClub,
} from "../repositories/clubs.js";
import { findUserById, listUsersByIds } from "../repositories/users.js";
import { generateClubTasteInsight, generateDiscussionQuestions } from "../services/bookAssistant.js";

const CLUB_INSIGHT_REFRESH_MS = 1000 * 60 * 60 * 24;
const CLUB_INSIGHT_FORMAT_VERSION = "v5";

type CreateClubBody = {
  name?: string;
  description?: string;
  vibe?: string;
  createdByUserId?: string;
};

type AddClubMemberBody = {
  userId?: string;
  role?: "owner" | "admin" | "member";
};

type UpdateClubBody = {
  name?: string;
  description?: string;
  vibe?: string;
};

type AddClubBookBody = {
  userId?: string;
  bookId?: string;
  title?: string;
  author?: string;
  genre?: string;
  description?: string;
  synopsis?: string;
  coverImageUrl?: string;
  isbn13?: string;
  status?: "saved" | "shortlisted" | "current" | "finished" | "removed";
  notes?: string;
  rating?: number | null;
  isCurrentRead?: boolean;
};

type UpdateClubBookBody = {
  status?: "saved" | "shortlisted" | "current" | "finished" | "removed";
  notes?: string;
  rating?: number | null;
  isCurrentRead?: boolean;
};

function serializeClubBooksResponse(clubBooks: ClubBook[], books: Book[]) {
  const booksById = new Map(books.map((book) => [book.id, book]));

  return clubBooks.map((clubBook) => ({
    ...clubBook.toJSON(),
    book: booksById.get(clubBook.bookId)?.toJSON() ?? null,
  }));
}

function normalizeTopTerms(values: string[]): string[] {
  const counts = new Map<string, number>();

  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    const normalized = value.toLowerCase();
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([value]) => value);
}

function buildShelfFingerprint(clubBooks: ClubBook[], booksById: Map<string, Book>): string {
  return [CLUB_INSIGHT_FORMAT_VERSION, ...[...clubBooks]
    .sort((left, right) => left.bookId.localeCompare(right.bookId) || left.userId.localeCompare(right.userId))
    .map((entry) => {
      const book = booksById.get(entry.bookId);
      return [
        entry.bookId,
        entry.status,
        entry.isCurrentRead ? "current" : "not-current",
        book?.genre || "",
        book?.author || "",
      ].join(":");
    })]
    .join("|");
}

async function getOrCreateCurrentDiscussionQuestions(clubId: string) {
  const club = await findClubById(clubId);

  if (!club) {
    throw new Error("club not found");
  }

  const currentClubBook = await findCurrentClubBook(club.id);

  if (!currentClubBook) {
    return {
      club,
      currentClubBook: null,
      record: null,
      book: null,
    };
  }

  const book = await findBookById(currentClubBook.bookId);

  if (!book) {
    throw new Error("current club book not found");
  }

  const existingRecord = await findDiscussionQuestionsForClubBook(club.id, book.id);

  if (existingRecord && existingRecord.questions.length === 5) {
    return {
      club,
      currentClubBook,
      record: existingRecord,
      book,
    };
  }

  const questions = await generateDiscussionQuestions({
    title: book.title,
    author: book.author,
    description: book.description || book.synopsis,
    genres: book.genre
      .split(/[,&/]/)
      .map((value) => value.trim())
      .filter(Boolean),
    clubName: club.name,
    clubVibe: club.vibe,
  });

  const record = await upsertDiscussionQuestionsForClubBook({
    id: `cdq${Date.now()}`,
    clubId: club.id,
    bookId: book.id,
    questions,
  });

  return {
    club,
    currentClubBook,
    record,
    book,
  };
}

export const clubsRouter = Router();

clubsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = String(req.query.userId || "").trim();
    const createdByUserId = String(req.query.createdByUserId || "").trim();

    const clubs = userId
      ? await listClubsForUser(userId)
      : await listClubs(createdByUserId ? { createdByUserId } : {});

    res.json({ clubs: clubs.map((club) => club.toJSON()) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not load clubs" });
  }
});

clubsRouter.post("/", async (req: Request<unknown, unknown, CreateClubBody>, res: Response) => {
  try {
    const { name, description = "", vibe = "", createdByUserId } = req.body ?? {};

    if (!name || !createdByUserId) {
      res.status(400).json({ error: "name and createdByUserId are required" });
      return;
    }

    const owner = await findUserById(String(createdByUserId));

    if (!owner) {
      res.status(404).json({ error: "creator user not found" });
      return;
    }

    const club = await createClub(
      new Club({
        id: `c${Date.now()}`,
        name: String(name),
        description: String(description),
        vibe: String(vibe),
        createdByUserId: owner.id,
      })
    );

    const membership = await addClubMember(
      new ClubMember({
        id: `cm${Date.now()}`,
        clubId: club.id,
        userId: owner.id,
        role: "owner",
      })
    );

    res.status(201).json({
      club: club.toJSON(),
      ownerMembership: membership.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not create club" });
  }
});

clubsRouter.get("/:clubId", async (req: Request, res: Response) => {
  try {
    const club = await findClubById(String(req.params.clubId));

    if (!club) {
      res.status(404).json({ error: "club not found" });
      return;
    }

    res.json({ club: club.toJSON() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not load club" });
  }
});

clubsRouter.patch("/:clubId", async (req: Request<{ clubId: string }, unknown, UpdateClubBody>, res: Response) => {
  try {
    const clubId = String(req.params.clubId);
    const existingClub = await findClubById(clubId);

    if (!existingClub) {
      res.status(404).json({ error: "club not found" });
      return;
    }

    const club = await updateClub(clubId, {
      name: req.body?.name,
      description: req.body?.description,
      vibe: req.body?.vibe,
    });

    res.json({ club: club?.toJSON() ?? existingClub.toJSON() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not update club" });
  }
});

clubsRouter.delete("/:clubId", async (req: Request, res: Response) => {
  try {
    const removed = await deleteClub(String(req.params.clubId));

    if (!removed) {
      res.status(404).json({ error: "club not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not delete club" });
  }
});

clubsRouter.get("/:clubId/members", async (req: Request, res: Response) => {
  try {
    const club = await findClubById(String(req.params.clubId));

    if (!club) {
      res.status(404).json({ error: "club not found" });
      return;
    }

    const members = await listMembersByClubId(club.id);
    const users = await listUsersByIds(members.map((member) => member.userId));
    const usersById = new Map(users.map((user) => [user.id, user]));

    res.json({
      members: members.map((member) => ({
        ...member.toJSON(),
        user: usersById.get(member.userId)?.toJSON() ?? null,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not load members" });
  }
});

clubsRouter.post("/:clubId/members", async (req: Request<{ clubId: string }, unknown, AddClubMemberBody>, res: Response) => {
  try {
    const club = await findClubById(req.params.clubId);

    if (!club) {
      res.status(404).json({ error: "club not found" });
      return;
    }

    const userId = String(req.body?.userId || "").trim();
    const role = req.body?.role || "member";

    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const user = await findUserById(userId);

    if (!user) {
      res.status(404).json({ error: "user not found" });
      return;
    }

    const existingMembership = await findClubMember(club.id, user.id);

    if (existingMembership) {
      res.status(409).json({ error: "user is already a member of this club" });
      return;
    }

    const membership = await addClubMember(
      new ClubMember({
        id: `cm${Date.now()}`,
        clubId: club.id,
        userId: user.id,
        role,
      })
    );

    res.status(201).json({ membership: membership.toJSON() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not add club member" });
  }
});

clubsRouter.get("/:clubId/members/:userId", async (req: Request, res: Response) => {
  try {
    const membership = await findClubMember(String(req.params.clubId), String(req.params.userId));

    if (!membership) {
      res.status(404).json({ error: "club membership not found" });
      return;
    }

    res.json({ membership: membership.toJSON() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not load club membership" });
  }
});

clubsRouter.patch(
  "/:clubId/members/:userId",
  async (req: Request<{ clubId: string; userId: string }, unknown, Pick<AddClubMemberBody, "role">>, res: Response) => {
    try {
      const clubId = String(req.params.clubId);
      const userId = String(req.params.userId);
      const role = req.body?.role;

      if (!role) {
        res.status(400).json({ error: "role is required" });
        return;
      }

      const membership = await updateClubMemberRole(clubId, userId, role);

      if (!membership) {
        res.status(404).json({ error: "club membership not found" });
        return;
      }

      res.json({ membership: membership.toJSON() });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "could not update club membership" });
    }
  }
);

clubsRouter.delete("/:clubId/members/:userId", async (req: Request, res: Response) => {
  try {
    const removed = await removeClubMember(String(req.params.clubId), String(req.params.userId));

    if (!removed) {
      res.status(404).json({ error: "club membership not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not delete club membership" });
  }
});

clubsRouter.get("/:clubId/books", async (req: Request, res: Response) => {
  try {
    const club = await findClubById(String(req.params.clubId));

    if (!club) {
      res.status(404).json({ error: "club not found" });
      return;
    }

    const userId = String(req.query.userId || "").trim();
    const status = String(req.query.status || "").trim() as ClubBook["status"] | "";
    const clubBooks = userId
      ? await listClubBooksByClubAndUser(club.id, userId, status ? { status } : {})
      : await listClubBooksByClubId(club.id, status ? { status } : {});

    const books = await listBooksByIds([...new Set(clubBooks.map((clubBook) => clubBook.bookId))]);

    res.json({
      clubBooks: serializeClubBooksResponse(clubBooks, books),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not load club books" });
  }
});

clubsRouter.get("/:clubId/discussion/current", async (req: Request, res: Response) => {
  try {
    const result = await getOrCreateCurrentDiscussionQuestions(String(req.params.clubId));

    if (!result.currentClubBook || !result.record || !result.book) {
      res.json({
        currentBookId: null,
        questions: [],
      });
      return;
    }

    res.json({
      currentBookId: result.book.id,
      questions: result.record.questions,
      book: result.book.toJSON(),
      generatedAt: result.record.updatedAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "club not found") {
      res.status(404).json({ error: "club not found" });
      return;
    }

    res.status(500).json({ error: error instanceof Error ? error.message : "could not load discussion questions" });
  }
});

clubsRouter.get("/:clubId/insights", async (req: Request, res: Response) => {
  try {
    const club = await findClubById(String(req.params.clubId));

    if (!club) {
      res.status(404).json({ error: "club not found" });
      return;
    }

    const [members, clubBooks] = await Promise.all([
      listMembersByClubId(club.id),
      listClubBooksByClubId(club.id),
    ]);
    const books = await listBooksByIds([...new Set(clubBooks.map((clubBook) => clubBook.bookId))]);
    const booksById = new Map(books.map((book) => [book.id, book]));
    const shelfFingerprint = buildShelfFingerprint(clubBooks, booksById);
    const cachedInsight = await findClubInsight(club.id);
    const cachedInsightLooksBroken =
      cachedInsight?.headline.includes("[object Object]") ||
      cachedInsight?.summary.includes("[object Object]") ||
      cachedInsight?.signals.some((signal) => signal.includes("[object Object]"));
    const cachedInsightIsFresh =
      cachedInsight && Date.now() - cachedInsight.updatedAt.getTime() < CLUB_INSIGHT_REFRESH_MS;

    if (cachedInsight && !cachedInsightLooksBroken && cachedInsight.shelfFingerprint === shelfFingerprint && cachedInsightIsFresh) {
      res.json({
        insight: {
          headline: cachedInsight.headline,
          summary: cachedInsight.summary,
          source: cachedInsight.source,
        },
      });
      return;
    }

    const currentEntry = clubBooks.find((entry) => entry.isCurrentRead || entry.status === "current") ?? null;
    const currentBook = currentEntry ? booksById.get(currentEntry.bookId) ?? null : null;
    const savedBooks = clubBooks
      .filter((entry) => entry.status !== "removed")
      .map((entry) => booksById.get(entry.bookId))
      .filter((book): book is Book => Boolean(book));
    const finishedBooks = clubBooks
      .filter((entry) => entry.status === "finished")
      .map((entry) => booksById.get(entry.bookId))
      .filter((book): book is Book => Boolean(book));

    const topGenres = normalizeTopTerms(
      savedBooks.flatMap((book) =>
        book.genre
          .split(/[,&/]/)
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );
    const topAuthors = normalizeTopTerms(savedBooks.map((book) => book.author));

    const insight = await generateClubTasteInsight({
      clubName: club.name,
      clubVibe: club.vibe,
      memberCount: members.length,
      memberNames: members.map((member) => member.userId || member.role).filter(Boolean).slice(0, 6),
      currentReadTitle: currentBook?.title,
      currentReadAuthor: currentBook?.author,
      currentReadDescription: currentBook?.synopsis || currentBook?.description || "",
      savedTitles: savedBooks.slice(0, 8).map((book) => book.title),
      finishedTitles: finishedBooks.slice(0, 8).map((book) => book.title),
      savedBookDetails: savedBooks
        .slice(0, 8)
        .map((book) => `${book.title} by ${book.author}${book.genre ? ` [${book.genre}]` : ""}`),
      finishedBookDetails: finishedBooks
        .slice(0, 8)
        .map((book) => `${book.title} by ${book.author}${book.genre ? ` [${book.genre}]` : ""}`),
      topGenres,
      topAuthors,
    });

    await upsertClubInsight({
      id: cachedInsight?.id ?? `ci${Date.now()}`,
      clubId: club.id,
      shelfFingerprint,
      headline: insight.headline,
      summary: insight.summary,
      signals: [],
      source: insight.source,
    });

    res.json({ insight });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not load club insights" });
  }
});

clubsRouter.post("/:clubId/books", async (req: Request<{ clubId: string }, unknown, AddClubBookBody>, res: Response) => {
  try {
    const club = await findClubById(req.params.clubId);

    if (!club) {
      res.status(404).json({ error: "club not found" });
      return;
    }

    const userId = String(req.body?.userId || "").trim();

    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const user = await findUserById(userId);

    if (!user) {
      res.status(404).json({ error: "user not found" });
      return;
    }

    const membership = await findClubMember(club.id, user.id);

    if (!membership) {
      res.status(403).json({ error: "user is not a member of this club" });
      return;
    }

    let book = req.body?.bookId ? await findBookById(String(req.body.bookId)) : null;

    if (!book) {
      const { title, author, genre = "", description = "", synopsis = "", coverImageUrl = "", isbn13 } = req.body ?? {};

      if (!title || !author) {
        res.status(400).json({ error: "bookId or title and author are required" });
        return;
      }

      book = await createBook(
        new Book({
          id: req.body?.bookId ? String(req.body.bookId) : `b${Date.now()}`,
          title: String(title),
          author: String(author),
          genre: String(genre),
          description: String(description),
          synopsis: String(synopsis || description),
          coverImageUrl: String(coverImageUrl || "") || null,
          isbn13: isbn13 ? String(isbn13) : null,
        })
      );
    }

    const shouldPromoteToCurrent = Boolean(req.body?.isCurrentRead) || req.body?.status === "current";
    const existingClubBook = await findClubBook(club.id, user.id, book.id);

    if (existingClubBook) {
      const responseClubBook = shouldPromoteToCurrent
        ? await promoteClubBookToCurrent(club.id, user.id, book.id, {
            notes: req.body?.notes !== undefined ? String(req.body.notes || "") : undefined,
            rating: req.body?.rating ?? undefined,
          })
        : existingClubBook;

      res.json({
        clubBook: {
          ...(responseClubBook ?? existingClubBook).toJSON(),
          book: book.toJSON(),
        },
      });
      return;
    }

    let clubBook: ClubBook;

    try {
      const createdClubBook = await addClubBook(
        new ClubBook({
          id: `cb${Date.now()}`,
          clubId: club.id,
          userId: user.id,
          bookId: book.id,
          status: req.body?.status || "saved",
          notes: String(req.body?.notes || ""),
          rating: req.body?.rating ?? null,
          isCurrentRead: Boolean(req.body?.isCurrentRead),
        })
      );

      clubBook = shouldPromoteToCurrent
        ? ((await promoteClubBookToCurrent(club.id, user.id, book.id, {
            notes: req.body?.notes !== undefined ? String(req.body.notes || "") : undefined,
            rating: req.body?.rating ?? undefined,
          })) ?? createdClubBook)
        : createdClubBook;
    } catch (error) {
      const isDuplicateKeyError =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505";

      if (!isDuplicateKeyError) {
        throw error;
      }

      const duplicateClubBook = await findClubBook(club.id, user.id, book.id);

      if (!duplicateClubBook) {
        throw error;
      }

      const responseClubBook = shouldPromoteToCurrent
        ? await promoteClubBookToCurrent(club.id, user.id, book.id, {
            notes: req.body?.notes !== undefined ? String(req.body.notes || "") : undefined,
            rating: req.body?.rating ?? undefined,
          })
        : duplicateClubBook;

      res.json({
        clubBook: {
          ...(responseClubBook ?? duplicateClubBook).toJSON(),
          book: book.toJSON(),
        },
      });
      return;
    }

    res.status(201).json({
      clubBook: {
        ...clubBook.toJSON(),
        book: book.toJSON(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not save club book" });
  }
});

clubsRouter.get("/:clubId/users/:userId/books/:bookId", async (req: Request, res: Response) => {
  try {
    const clubBook = await findClubBook(
      String(req.params.clubId),
      String(req.params.userId),
      String(req.params.bookId)
    );

    if (!clubBook) {
      res.status(404).json({ error: "club book not found" });
      return;
    }

    const book = await findBookById(clubBook.bookId);

    res.json({
      clubBook: {
        ...clubBook.toJSON(),
        book: book?.toJSON() ?? null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not load club book" });
  }
});

clubsRouter.patch(
  "/:clubId/users/:userId/books/:bookId",
  async (
    req: Request<{ clubId: string; userId: string; bookId: string }, unknown, UpdateClubBookBody>,
    res: Response
  ) => {
    try {
      const clubId = String(req.params.clubId);
      const userId = String(req.params.userId);
      const bookId = String(req.params.bookId);
      const shouldPromoteToCurrent = req.body?.isCurrentRead === true || req.body?.status === "current";

      const clubBook = shouldPromoteToCurrent
        ? await promoteClubBookToCurrent(clubId, userId, bookId, {
            notes: req.body?.notes,
            rating: req.body?.rating,
          })
        : await updateClubBook(clubId, userId, bookId, {
            status: req.body?.status,
            notes: req.body?.notes,
            rating: req.body?.rating,
            isCurrentRead: req.body?.isCurrentRead,
          });

      if (!clubBook) {
        res.status(404).json({ error: "club book not found" });
        return;
      }

      const book = await findBookById(clubBook.bookId);

      res.json({
        clubBook: {
          ...clubBook.toJSON(),
          book: book?.toJSON() ?? null,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "could not update club book" });
    }
  }
);

clubsRouter.delete("/:clubId/users/:userId/books/:bookId", async (req: Request, res: Response) => {
  try {
    const removed = await removeClubBook(
      String(req.params.clubId),
      String(req.params.userId),
      String(req.params.bookId)
    );

    if (!removed) {
      res.status(404).json({ error: "club book not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not delete club book" });
  }
});
