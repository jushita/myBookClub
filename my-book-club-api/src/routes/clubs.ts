import { Router } from "express";
import type { Request, Response } from "express";
import { Book, Club, ClubBook, ClubMember } from "../domain/entities/index.js";
import { listBooksByIds, createBook, findBookById } from "../repositories/books.js";
import {
  addClubBook,
  removeClubBook,
  findClubBook,
  listClubBooksByClubAndUser,
  listClubBooksByClubId,
  updateClubBook,
} from "../repositories/clubBooks.js";
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
    const clubBooks = userId
      ? await listClubBooksByClubAndUser(club.id, userId)
      : await listClubBooksByClubId(club.id);

    const books = await listBooksByIds([...new Set(clubBooks.map((clubBook) => clubBook.bookId))]);

    res.json({
      clubBooks: serializeClubBooksResponse(clubBooks, books),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not load club books" });
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
      const { title, author, genre = "", description = "", synopsis = "", isbn13 } = req.body ?? {};

      if (!title || !author) {
        res.status(400).json({ error: "bookId or title and author are required" });
        return;
      }

      book = await createBook(
        new Book({
          id: `b${Date.now()}`,
          title: String(title),
          author: String(author),
          genre: String(genre),
          description: String(description),
          synopsis: String(synopsis || description),
          isbn13: isbn13 ? String(isbn13) : null,
        })
      );
    }

    const existingClubBook = await findClubBook(club.id, user.id, book.id);

    if (existingClubBook) {
      res.json({
        clubBook: {
          ...existingClubBook.toJSON(),
          book: book.toJSON(),
        },
      });
      return;
    }

    let clubBook: ClubBook;

    try {
      clubBook = await addClubBook(
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

      res.json({
        clubBook: {
          ...duplicateClubBook.toJSON(),
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
      const clubBook = await updateClubBook(
        String(req.params.clubId),
        String(req.params.userId),
        String(req.params.bookId),
        {
          status: req.body?.status,
          notes: req.body?.notes,
          rating: req.body?.rating,
          isCurrentRead: req.body?.isCurrentRead,
        }
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
