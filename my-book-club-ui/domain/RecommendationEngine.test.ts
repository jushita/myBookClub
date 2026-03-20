import test from "node:test";
import assert from "node:assert/strict";
import { RecommendationEngine } from "./RecommendationEngine";
import type { Book, Club, Recommendation } from "../types";

function makeBook(overrides: Partial<Book> & Pick<Book, "id" | "title" | "author">): Book {
  return {
    id: overrides.id,
    title: overrides.title,
    author: overrides.author,
    genre: overrides.genre ?? "",
    note: overrides.note ?? "",
    description: overrides.description,
    coverImageUrl: overrides.coverImageUrl ?? null,
    synopsis: overrides.synopsis,
    averageRating: overrides.averageRating ?? null,
    ratingsCount: overrides.ratingsCount ?? null,
  };
}

function makeRecommendation(id: string, title: string, author: string, matchReason = "Strong fit"): Recommendation {
  return {
    ...makeBook({
      id,
      title,
      author,
      genre: "thriller",
      note: "Fast-paced and twisty.",
    }),
    matchReason,
  };
}

const club: Club = {
  id: "club-1",
  name: "Midnight Readers",
  vibe: "Atmospheric",
  description: "Loves tense page turners",
  promptSeed: "Atmospheric thrillers with strong mood",
};

test("mergeCatalog preserves first-seen books and removes duplicate ids", () => {
  const engine = new RecommendationEngine([]);
  const shared = makeBook({ id: "b1", title: "Gone Girl", author: "Gillian Flynn" });
  const merged = engine.mergeCatalog(
    [shared, makeBook({ id: "b2", title: "Rebecca", author: "Daphne du Maurier" })],
    [shared],
    [makeRecommendation("b3", "Sharp Objects", "Gillian Flynn")]
  );

  assert.deepEqual(
    merged.map((book) => book.id),
    ["b1", "b2", "b3"]
  );
});

test("filterCatalog matches title, author, genre, and note", () => {
  const engine = new RecommendationEngine([]);
  const catalog = [
    makeBook({ id: "b1", title: "Rebecca", author: "Daphne du Maurier", genre: "gothic", note: "moody classic" }),
    makeBook({ id: "b2", title: "Project Hail Mary", author: "Andy Weir", genre: "science fiction", note: "space survival" }),
  ];

  assert.deepEqual(
    engine.filterCatalog(catalog, "space").map((book) => book.id),
    ["b2"]
  );
  assert.deepEqual(
    engine.filterCatalog(catalog, "du maurier").map((book) => book.id),
    ["b1"]
  );
});

test("buildClubRecommendations tailors match reasons to club vibe", () => {
  const engine = new RecommendationEngine([makeRecommendation("b1", "The Maid", "Nita Prose", "Clever mystery.")]);
  const recommendations = engine.buildClubRecommendations("mystery", club);

  assert.equal(recommendations.length, 1);
  assert.match(recommendations[0].matchReason, /Midnight Readers/);
  assert.match(recommendations[0].matchReason, /Atmospheric/i);
});

test("buildAiRecommendations folds the prompt into match reasons", () => {
  const engine = new RecommendationEngine([makeRecommendation("b1", "The Maid", "Nita Prose", "Clever mystery.")]);
  const recommendations = engine.buildAiRecommendations("smart mystery", club);

  assert.equal(recommendations.length, 1);
  assert.match(recommendations[0].matchReason, /smart mystery/);
});

test("buildPersonalizedRecommendations excludes current shelf signals and prioritizes matching books", () => {
  const engine = new RecommendationEngine([]);
  const saved = makeBook({
    id: "saved-1",
    title: "Gone Girl",
    author: "Gillian Flynn",
    genre: "thriller",
    note: "unreliable narrator",
    description: "dark psychological thriller",
  });
  const current = makeBook({
    id: "current-1",
    title: "The Girl on the Train",
    author: "Paula Hawkins",
    genre: "thriller",
    note: "psychological suspense",
  });
  const catalog = [
    saved,
    current,
    makeBook({
      id: "candidate-1",
      title: "Sharp Objects",
      author: "Gillian Flynn",
      genre: "thriller",
      note: "dark family suspense",
      description: "psychological thriller",
    }),
    makeBook({
      id: "candidate-2",
      title: "A Psalm for the Wild-Built",
      author: "Becky Chambers",
      genre: "science fiction",
      note: "gentle and hopeful",
    }),
  ];

  const recommendations = engine.buildPersonalizedRecommendations(catalog, {
    savedBooks: [saved],
    finishedBooks: [],
    currentBook: current,
    club,
    limit: 2,
    rotationSeed: 7,
  });

  assert.equal(recommendations.length, 2);
  assert.equal(recommendations[0].id, "candidate-1");
  assert.ok(recommendations.every((book) => book.id !== "saved-1" && book.id !== "current-1"));
  assert.match(recommendations[0].matchReason, /The Girl on the Train|thriller/i);
});
