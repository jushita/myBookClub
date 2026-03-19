import test from "node:test";
import assert from "node:assert/strict";
import { classifyImportTier } from "./openLibraryImportRules.js";

test("keeps a consumer thriller with a risky title term", () => {
  const tier = classifyImportTier({
    title: "The Marriage Act",
    authorName: "John Marrs",
    language: "/languages/eng",
    subjects: ["Fiction", "Thrillers", "Suspense fiction", "Dystopian fiction"],
    publishers: ["Hanover Square Press"],
    isbn13: "9781335009111",
    coverImageUrl: "https://covers.openlibrary.org/b/id/123-L.jpg",
    description:
      "A speculative thriller about a near-future marriage system that tightens state control over relationships.",
    pageCount: 400,
  });

  assert.notEqual(tier, "reject");
});

test("rejects an institutional legal document with stacked risk signals", () => {
  const tier = classifyImportTier({
    title: "Bank of England Bill",
    authorName: "Unknown author",
    language: "/languages/eng",
    subjects: ["Law", "Government policy", "Legislation", "Courts"],
    publishers: ["Stationery Office Books"],
    isbn13: "9780108360824",
    pageCount: 48,
  });

  assert.equal(tier, "reject");
});

test("rejects records without explicit English language for the current v1 policy", () => {
  const tier = classifyImportTier({
    title: "A Good Book",
    authorName: "Real Author",
    subjects: ["Fiction", "Mystery", "Suspense fiction"],
    isbn13: "9780000000001",
    coverImageUrl: "https://covers.openlibrary.org/b/id/456-L.jpg",
    pageCount: 320,
  });

  assert.equal(tier, "reject");
});

test("promotes high-quality reader books to tierA", () => {
  const tier = classifyImportTier({
    title: "The Seven Husbands of Evelyn Hugo",
    authorName: "Taylor Jenkins Reid",
    language: "/languages/eng",
    subjects: ["Fiction", "Historical fiction", "Romance", "Popular culture"],
    publishers: ["Atria Books"],
    isbn13: "9781501161933",
    coverImageUrl: "https://covers.openlibrary.org/b/id/789-L.jpg",
    description:
      "A glamorous novel about fame, reinvention, old Hollywood, and the cost of love across a lifetime.",
    pageCount: 400,
  });

  assert.equal(tier, "tierA");
});

test("keeps a sparse but valid reader classic in the catalog", () => {
  const tier = classifyImportTier({
    title: "Rebecca",
    authorName: "Daphne du Maurier",
    language: "/languages/eng",
    subjects: ["Fiction", "Gothic fiction", "Psychological fiction"],
    publishers: ["Virago"],
    pageCount: 320,
  });

  assert.notEqual(tier, "reject");
});
