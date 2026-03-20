import test from "node:test";
import assert from "node:assert/strict";
import { getBookCoverUrl } from "./bookCoverFallbacks";

test("getBookCoverUrl prefers an explicit cover image url", () => {
  const url = getBookCoverUrl({
    title: "Gone Girl",
    author: "Gillian Flynn",
    coverImageUrl: "https://example.com/custom-cover.jpg",
  });

  assert.equal(url, "https://example.com/custom-cover.jpg");
});

test("getBookCoverUrl returns a known fallback when cover is missing", () => {
  const url = getBookCoverUrl({
    title: "Gone Girl",
    author: "Gillian Flynn",
    coverImageUrl: null,
  });

  assert.equal(url, "https://covers.openlibrary.org/b/isbn/9780307588371-L.jpg");
});

test("getBookCoverUrl returns null for unknown books without a cover", () => {
  const url = getBookCoverUrl({
    title: "Completely Unknown Book",
    author: "Unknown Author",
    coverImageUrl: null,
  });

  assert.equal(url, null);
});
