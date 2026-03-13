import { Router } from "express";
import type { Request, Response } from "express";
import { Book } from "../domain/entities/index.js";
import { createBook, findBookById, listBooks } from "../repositories/books.js";

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
    const result = await listBooks({
      query: query || undefined,
      genre: genre || undefined,
    });

    res.json({ books: result.map((book) => book.toJSON()) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not load books" });
  }
});

booksRouter.get("/:id", async (req: Request, res: Response) => {
  const book = await findBookById(String(req.params.id));

  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  res.json({ book: book.toJSON() });
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

    res.status(201).json({ book: newBook.toJSON() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "could not create book" });
  }
});
