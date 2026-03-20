import test from "node:test";
import assert from "node:assert/strict";
import { generateClubTasteInsight, generateDiscussionQuestions } from "./bookAssistant.js";

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
