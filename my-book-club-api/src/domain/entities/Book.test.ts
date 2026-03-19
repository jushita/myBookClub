import test from "node:test";
import assert from "node:assert/strict";
import { Book } from "./Book.js";

test("Book constructor trims fields and falls back synopsis to description", () => {
  const book = new Book({
    id: " b1 ",
    title: "  The Left Hand of Darkness ",
    author: " Ursula K. Le Guin ",
    description: "  A chilly, political classic. ",
    genre: "  Science Fiction ",
  });

  assert.equal(book.id, " b1 ");
  assert.equal(book.title, "The Left Hand of Darkness");
  assert.equal(book.author, "Ursula K. Le Guin");
  assert.equal(book.genre, "Science Fiction");
  assert.equal(book.description, "A chilly, political classic.");
  assert.equal(book.synopsis, "A chilly, political classic.");
});

test("Book.fromDatabase parses vector strings and rating metadata", () => {
  const book = Book.fromDatabase({
    id: "b2",
    title: "Gone Girl",
    author: "Gillian Flynn",
    embedding_vector: "[1, 2.5, 3]",
    average_rating: 4.12,
    ratings_count: 424242,
    created_at: "2026-03-19T00:00:00.000Z",
  });

  assert.deepEqual(book.embedding, [1, 2.5, 3]);
  assert.equal(book.averageRating, 4.12);
  assert.equal(book.ratingsCount, 424242);
});

test("Book.fromDatabase ignores invalid vector strings", () => {
  const book = Book.fromDatabase({
    id: "b3",
    title: "Rebecca",
    author: "Daphne du Maurier",
    embedding_vector: "not-a-vector",
    created_at: "2026-03-19T00:00:00.000Z",
  });

  assert.equal(book.embedding, null);
});

test("Book constructor rejects missing title", () => {
  assert.throws(
    () =>
      new Book({
        id: "b4",
        title: " ",
        author: "Author",
      }),
    /Book title is required/
  );
});
