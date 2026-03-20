import test from "node:test";
import assert from "node:assert/strict";
import { Book } from "../domain/entities/Book.js";
import { searchBooksWithFallback } from "./bookLookup.js";

function makeBook(overrides: Partial<ConstructorParameters<typeof Book>[0]> = {}) {
  return new Book({
    id: overrides.id ?? "book-1",
    title: overrides.title ?? "Gone Girl",
    author: overrides.author ?? "Gillian Flynn",
    genre: overrides.genre ?? "Psychological thriller",
    description: overrides.description ?? "A sharp psychological thriller.",
    synopsis: overrides.synopsis ?? "A sharp psychological thriller.",
    subjects: overrides.subjects ?? ["thriller"],
    source: overrides.source ?? "goodbooks10k",
  });
}

test("searchBooksWithFallback keeps strong local matches and enriches them", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  globalThis.fetch = (async (input: string | URL | Request) => {
    fetchCalls += 1;
    const url = String(input);

    if (url.includes("openlibrary.org/search.json")) {
      return new Response(
        JSON.stringify({
          docs: [
            {
              key: "/works/OL123W",
              title: "Gone Girl",
              author_name: ["Gillian Flynn"],
              subject: ["Thriller"],
              first_publish_year: 2012,
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as typeof fetch;

  try {
    const localBook = makeBook();
    const results = await searchBooksWithFallback(
      {
        query: "Gone Girl",
        limit: 5,
      },
      [localBook]
    );

    assert.equal(results.length, 1);
    assert.equal(results[0].id, localBook.id);
    assert.equal(results[0].title, "Gone Girl");
    assert.ok(fetchCalls >= 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("searchBooksWithFallback falls back to Open Library when local matches are weak", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);

    if (url.includes("openlibrary.org/search.json")) {
      return new Response(
        JSON.stringify({
          docs: [
            {
              key: "/works/OL999W",
              title: "The Marriage Act",
              author_name: ["John Marrs"],
              subject: ["Thriller", "Dystopia"],
              first_publish_year: 2023,
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  }) as typeof fetch;

  try {
    const weakLocal = makeBook({
      id: "local-1",
      title: "Gone Girl",
      author: "Gillian Flynn",
    });

    const results = await searchBooksWithFallback(
      {
        query: "The Marriage Act",
        limit: 5,
      },
      [weakLocal]
    );

    assert.equal(results.length, 1);
    assert.equal(results[0].title, "The Marriage Act");
    assert.equal(results[0].author, "John Marrs");
    assert.equal(results[0].source, "local");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
