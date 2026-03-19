import { Router } from "express";
import type { Request, Response } from "express";
import { Book } from "../domain/entities/index.js";
import { createBook, findBookById, listBooks } from "../repositories/books.js";
import { embedTextWithOllama } from "../services/embeddings.js";
import { enrichBookFromExternalSources, searchBooksWithFallback } from "../services/bookLookup.js";

type CreateBookBody = {
  title?: string;
  author?: string;
  genre?: string;
  description?: string;
};

export const booksRouter = Router();

booksRouter.get("/", async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || "").trim();
    const genre = String(req.query.genre || "").trim();
    const requestedLimit = Number(req.query.limit || "50");
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 50;
    const queryEmbedding = query ? await embedTextWithOllama(query).catch(() => null) : null;
    const localBooks = await listBooks({
      query: query || undefined,
      genre: genre || undefined,
      embedding: queryEmbedding?.embedding ?? null,
      limit,
    });
    const result = await searchBooksWithFallback(
      {
        query: query || undefined,
        genre: genre || undefined,
        limit,
      },
      localBooks
    );

    res.json({ books: result.map((book) => book.toPublicJSON()) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not load books" });
  }
});

booksRouter.get("/:id", async (req: Request, res: Response) => {
  const localBook = await findBookById(String(req.params.id));

  if (!localBook) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  const book = await enrichBookFromExternalSources(localBook);
  res.json({ book: book.toPublicJSON() });
});

booksRouter.post("/", async (req: Request<unknown, unknown, CreateBookBody>, res: Response) => {
  try {
    const { title, author, genre = "Unknown", description = "" } = req.body ?? {};

    if (!title || !author) {
      res.status(400).json({ error: "title and author are required" });
      return;
    }

    const newBook = await createBook(
      new Book({
        id: `b${Date.now()}`,
        title,
        author,
        genre,
        description,
      })
    );

    res.status(201).json({ book: newBook.toPublicJSON() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not create book" });
  }
});
