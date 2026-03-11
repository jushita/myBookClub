import { Router } from "express";
import { books } from "../data/books.js";

export const booksRouter = Router();

booksRouter.get("/", (req, res) => {
  const query = String(req.query.q || "").trim().toLowerCase();

  if (!query) {
    res.json({ books });
    return;
  }

  const filteredBooks = books.filter((book) => {
    return [book.title, book.author, book.genre, book.description]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  res.json({ books: filteredBooks });
});

booksRouter.get("/:id", (req, res) => {
  const book = books.find((entry) => entry.id === req.params.id);

  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }

  res.json({ book });
});

booksRouter.post("/", (req, res) => {
  const { title, author, genre = "Unknown", description = "" } = req.body ?? {};

  if (!title || !author) {
    res.status(400).json({ error: "title and author are required" });
    return;
  }

  const newBook = {
    id: `b${Date.now()}`,
    title,
    author,
    genre,
    description,
  };

  books.unshift(newBook);
  res.status(201).json({ book: newBook });
});
