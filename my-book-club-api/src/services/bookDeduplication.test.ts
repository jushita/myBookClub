import test from "node:test";
import assert from "node:assert/strict";
import { dedupeBooksByCompleteness } from "./bookDeduplication.js";

test("dedupeBooksByCompleteness keeps the more complete duplicate title", () => {
  const books = dedupeBooksByCompleteness([
    {
      id: "openlibrary:1",
      title: "The Housemaid",
      author: "Unknown author",
      description: "",
      synopsis: "",
      coverImageUrl: null,
    },
    {
      id: "local:1",
      title: "The Housemaid",
      author: "Freida McFadden",
      description: "A fast domestic thriller with secrets and reversals.",
      synopsis: "A fast domestic thriller with secrets and reversals.",
      coverImageUrl: "https://example.com/cover.jpg",
    },
  ]);

  assert.equal(books.length, 1);
  assert.equal(books[0]?.id, "local:1");
});

test("dedupeBooksByCompleteness keeps same-title books by different known authors", () => {
  const books = dedupeBooksByCompleteness([
    {
      id: "a",
      title: "The One",
      author: "John Marrs",
      description: "A speculative thriller.",
      synopsis: "A speculative thriller.",
      coverImageUrl: "https://example.com/a.jpg",
    },
    {
      id: "b",
      title: "The One",
      author: "Kiera Cass",
      description: "A YA dystopian novel.",
      synopsis: "A YA dystopian novel.",
      coverImageUrl: "https://example.com/b.jpg",
    },
  ]);

  assert.equal(books.length, 2);
  assert.deepEqual(
    books.map((book) => book.id),
    ["a", "b"]
  );
});
