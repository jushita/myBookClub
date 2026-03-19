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
      currentReadTitle: "Gone Girl",
      currentReadAuthor: "Gillian Flynn",
      savedTitles: ["Gone Girl", "Sharp Objects"],
      finishedTitles: ["Rebecca"],
      topGenres: ["thriller", "mystery"],
      topAuthors: ["Gillian Flynn"],
    });

    assert.equal(insight.source, "fallback");
    assert.match(insight.headline, /loyalists|snapshot/i);
    assert.equal(insight.signals.length, 3);
    assert.match(insight.summary, /Gone Girl/);
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
          summary: "The club keeps circling dark suspense.",
          signals: [
            { text: "High appetite for twisty, high-tension fiction." },
            { primary: "One current read", secondary: "is setting the tone." },
            ["Recurring", "psychological suspense interest"],
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
      savedTitles: ["Gone Girl"],
      finishedTitles: [],
      topGenres: ["thriller"],
      topAuthors: ["Gillian Flynn"],
    });

    assert.equal(insight.source, "ollama");
    assert.equal(insight.signals.length, 3);
    assert.equal(insight.signals[0], "High appetite for twisty, high-tension fiction.");
    assert.equal(insight.signals[1], "One current read is setting the tone.");
    assert.equal(insight.signals[2], "Recurring, psychological suspense interest");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
