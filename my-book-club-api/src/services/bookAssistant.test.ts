import test from "node:test";
import assert from "node:assert/strict";
import { Book } from "../domain/entities/Book.js";
import { __testables, generateClubTasteInsight, generateDiscussionQuestions } from "./bookAssistant.js";

test("generateDiscussionQuestions falls back to deterministic questions when Ollama fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;

  try {
    const questions = await generateDiscussionQuestions({
      title: "Rebecca",
      author: "Daphne du Maurier",
      clubName: "Night Readers",
      clubVibe: "moody",
    });

    assert.equal(questions.length, 5);
    assert.match(questions[0], /Rebecca/);
    assert.match(questions[2], /Daphne du Maurier|the author/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("generateDiscussionQuestions normalizes structured Ollama question objects", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        response: JSON.stringify({
          questions: [
            { text: "Why do you think Alicia chose silence instead of self-defense?" },
            { lead: "How did your perception of Theo change", tail: "as the story unfolded?" },
            ["Did the twist reframe how you interpreted earlier events?"],
            { a: "What role does obsession play", b: "in the characters' decisions?" },
            { prompt: "Did the ending feel like justice, revenge, or something murkier?" },
          ],
        }),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    )) as typeof fetch;

  try {
    const questions = await generateDiscussionQuestions({
      title: "The Silent Patient",
      description: "A psychological thriller about a woman who stops speaking after a violent act.",
      genres: ["psychological thriller", "mystery"],
      clubVibe: "deep",
    });

    assert.equal(questions.length, 5);
    assert.match(questions[0], /silence/i);
    assert.match(questions[1], /Theo/i);
    assert.ok(questions.every((question) => !question.includes("[object Object]")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("generateClubTasteInsight falls back cleanly when Ollama is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("ollama unavailable");
  }) as typeof fetch;

  try {
    const insight = await generateClubTasteInsight({
      clubName: "Page Turners",
      clubVibe: "intense",
      memberCount: 4,
      memberNames: ["Jushita", "Maya", "Sam", "Nina"],
      currentReadTitle: "Gone Girl",
      currentReadAuthor: "Gillian Flynn",
      currentReadDescription: "A sharp psychological thriller about marriage, secrets, and public image.",
      savedTitles: ["Gone Girl", "Sharp Objects"],
      finishedTitles: ["Rebecca"],
      savedBookDetails: ["Gone Girl by Gillian Flynn [thriller]", "Sharp Objects by Gillian Flynn [thriller]"],
      finishedBookDetails: ["Rebecca by Daphne du Maurier [mystery]"],
      topGenres: ["thriller", "mystery"],
      topAuthors: ["Gillian Flynn"],
    });

    assert.equal(insight.source, "fallback");
    assert.match(insight.headline, /taste|standards/i);
    assert.match(insight.summary, /Gone Girl/);
    assert.match(insight.summary, /you|your/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("generateClubTasteInsight normalizes structured Ollama signal objects", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        response: JSON.stringify({
          headline: "Thriller obsessives",
          summary: "You keep stocking the shelf with dark suspense, and Gone Girl energy is clearly not an accident.",
          signals: [
            { text: "Gone Girl is not just sitting there; it is basically acting as your taste spokesperson." },
            { primary: "Thriller is doing most of the heavy lifting", secondary: "and nobody seems upset about it." },
            ["Gillian Flynn", "keeps showing up like a very persuasive bad influence."],
          ],
        }),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    )) as typeof fetch;

  try {
    const insight = await generateClubTasteInsight({
      clubName: "Page Turners",
      memberCount: 3,
      memberNames: ["Jushita", "Maya", "Sam"],
      currentReadDescription: "",
      savedTitles: ["Gone Girl"],
      finishedTitles: [],
      savedBookDetails: ["Gone Girl by Gillian Flynn [thriller]"],
      finishedBookDetails: [],
      topGenres: ["thriller"],
      topAuthors: ["Gillian Flynn"],
    });

    assert.equal(insight.source, "ollama");
    assert.match(insight.summary, /you|your/i);
    assert.match(insight.summary, /gone girl|suspense/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fallback plan does not leak club want-list authors into explicit theme prompts", () => {
  const plan = __testables.buildFallbackPlan("I want to read a sci fi thriller", {
    clubWantAuthors: ["Freida McFadden"],
    clubWantGenres: ["psychological thriller"],
  });

  assert.equal(plan.intent, "theme-discovery");
  assert.deepEqual(plan.authorSeeds, []);
  assert.deepEqual(plan.similarTo, []);
  assert.ok(plan.themeSeeds.includes("science fiction"));
  assert.ok(plan.themeSeeds.includes("thriller"));
});

test("theme prompts reject weak off-theme local matches", () => {
  const plan = __testables.buildFallbackPlan("I want to read a sci fi thriller");
  const offThemeBook = new Book({
    id: "freida-1",
    title: "The Housemaid",
    author: "Freida McFadden",
    genre: "psychological thriller",
    description: "A domestic thriller full of secrets and tension.",
    synopsis: "A twisty domestic suspense novel.",
  });
  const onThemeBook = new Book({
    id: "sf-1",
    title: "Dark Matter",
    author: "Blake Crouch",
    genre: "science fiction thriller",
    description: "A high-concept science fiction thriller about parallel lives and abduction.",
    synopsis: "A propulsive science fiction thriller.",
  });

  const offThemeRanked = __testables.rankBooks([offThemeBook], plan);
  assert.equal(__testables.hasStrongLocalIntentMatch(plan, offThemeRanked), false);

  const mixedRanked = __testables.rankBooks([offThemeBook, onThemeBook], plan);
  assert.equal(mixedRanked[0]?.title, "Dark Matter");
  assert.equal(__testables.hasStrongLocalIntentMatch(plan, mixedRanked), true);
  assert.deepEqual(
    __testables.selectIntentAlignedBooks(mixedRanked, plan, 5).map((book) => book.title),
    ["Dark Matter"]
  );
});

test("compound theme prompts do not relax to single-theme matches", () => {
  const plan = __testables.buildFallbackPlan("I want to read a sci fi thriller");
  const sciFiOnlyBook = new Book({
    id: "sf-only",
    title: "Dune",
    author: "Frank Herbert",
    genre: "science fiction",
    description: "An epic science fiction novel set on Arrakis.",
    synopsis: "An epic science fiction novel set on Arrakis.",
  });

  const ranked = __testables.rankBooks([sciFiOnlyBook], plan);
  assert.equal(__testables.hasStrongLocalIntentMatch(plan, ranked), false);
  assert.deepEqual(__testables.selectIntentAlignedBooks(ranked, plan, 5).map((book) => book.title), []);
});

test("explicit genre prompts enforce a hard genre filter", () => {
  const plan = __testables.buildFallbackPlan("I want a fantasy book");
  const fantasyBook = new Book({
    id: "fantasy-1",
    title: "The Priory of the Orange Tree",
    author: "Samantha Shannon",
    genre: "epic fantasy",
    description: "A sweeping fantasy novel with dragons and court politics.",
    synopsis: "An epic fantasy about dragons and divided realms.",
  });
  const offGenreBook = new Book({
    id: "thriller-1",
    title: "The Housemaid",
    author: "Freida McFadden",
    genre: "psychological thriller",
    description: "A fast domestic thriller about secrets and lies.",
    synopsis: "A twisty psychological thriller.",
  });

  const ranked = __testables.rankBooks([offGenreBook, fantasyBook], plan);
  assert.deepEqual(__testables.selectIntentAlignedBooks(ranked, plan, 5).map((book) => book.title), [
    "The Priory of the Orange Tree",
  ]);
});

test("recent releases and classics outrank middling matches", () => {
  const plan = __testables.buildFallbackPlan("I want a fantasy book");
  const recentFantasy = new Book({
    id: "recent-fantasy",
    title: "The Adventures of Amina al-Sirafi",
    author: "Shannon Chakraborty",
    genre: "fantasy",
    description: "A recent fantasy adventure on the high seas.",
    synopsis: "A 2023 fantasy adventure.",
    publishedAt: "2023-01-01",
    popularityScore: 120,
  });
  const classicFantasy = new Book({
    id: "classic-fantasy",
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    genre: "fantasy",
    description: "A classic fantasy quest novel.",
    synopsis: "A foundational fantasy classic.",
    publishedAt: "1937-01-01",
    popularityScore: 300,
    averageRating: 4.7,
    ratingsCount: 15000,
  });
  const middlingFantasy = new Book({
    id: "middling-fantasy",
    title: "A Random Midlist Fantasy",
    author: "Some Author",
    genre: "fantasy",
    description: "A competent fantasy novel.",
    synopsis: "A competent fantasy novel.",
    publishedAt: "2011-01-01",
    popularityScore: 20,
  });

  const ranked = __testables.rankBooks([middlingFantasy, recentFantasy, classicFantasy], plan);
  assert.equal(ranked[2]?.title, "A Random Midlist Fantasy");
});

test("popular authors get a ranking boost within the same genre", () => {
  const plan = __testables.buildFallbackPlan("I want a fantasy book");
  const popularAuthorAnchor = new Book({
    id: "anchor",
    title: "Mega Hit Fantasy",
    author: "Famous Fantasy Author",
    genre: "fantasy",
    description: "A massively popular fantasy hit.",
    synopsis: "A massively popular fantasy hit.",
    publishedAt: "2018-01-01",
    popularityScore: 320,
    averageRating: 4.5,
    ratingsCount: 9000,
  });
  const secondPopularAuthorBook = new Book({
    id: "second",
    title: "Deep Cut Fantasy",
    author: "Famous Fantasy Author",
    genre: "fantasy",
    description: "Another fantasy novel by a very popular author.",
    synopsis: "Another fantasy novel by a very popular author.",
    publishedAt: "2018-01-01",
    popularityScore: 20,
  });
  const lessPopularAuthorBook = new Book({
    id: "other",
    title: "Neighboring Fantasy",
    author: "Another Author",
    genre: "fantasy",
    description: "A similar fantasy match.",
    synopsis: "A similar fantasy match.",
    publishedAt: "2018-01-01",
    popularityScore: 28,
  });

  const ranked = __testables.rankBooks([lessPopularAuthorBook, secondPopularAuthorBook, popularAuthorAnchor], plan);
  assert.equal(ranked[1]?.title, "Deep Cut Fantasy");
});
