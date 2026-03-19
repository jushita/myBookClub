import test from "node:test";
import assert from "node:assert/strict";
import { buildBookEmbeddingText, embedTextWithOllama } from "./embeddings.js";

test("buildBookEmbeddingText joins meaningful fields in order", () => {
  const text = buildBookEmbeddingText({
    title: "The Secret History",
    author: "Donna Tartt",
    genre: "Literary Fiction",
    description: "A dark campus novel.",
    synopsis: "",
    subjects: ["friendship", "murder"],
  });

  assert.equal(
    text,
    "The Secret History. Donna Tartt. Literary Fiction. A dark campus novel.. friendship. murder"
  );
});

test("embedTextWithOllama returns null for blank text without calling fetch", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("should not be called");
  }) as typeof fetch;

  try {
    const result = await embedTextWithOllama("   ");
    assert.equal(result, null);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("embedTextWithOllama caches repeated prompt embeddings", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = (async () => {
    callCount += 1;
    return new Response(JSON.stringify({ embedding: [0.1, 0.2, 0.3] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const first = await embedTextWithOllama("dark academia");
    const second = await embedTextWithOllama("dark academia");

    assert.deepEqual(first, {
      embedding: [0.1, 0.2, 0.3],
      model: "mxbai-embed-large",
    });
    assert.deepEqual(second, first);
    assert.equal(callCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
