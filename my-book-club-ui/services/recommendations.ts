import type { Recommendation, RecommendationResult } from "../types";
import { getBookCoverUrl } from "../data/bookCoverFallbacks";
import { normalizeGenreLabel, pickDisplaySummary } from "./bookPresentation";
import { apiBaseUrl, requestJson } from "./http";

type ApiBook = {
  id: string;
  title: string;
  author: string;
  genre: string;
  description?: string;
  synopsis?: string;
  coverImageUrl?: string | null;
};

type RecommendationResponse = {
  searchPlan: {
    explanation?: string;
    query?: string;
    genres?: string[];
    moods?: string[];
    seasonalContext?: string[];
    source?: "ollama" | "fallback";
  };
  books: ApiBook[];
};

type DiscussionQuestionsResponse = {
  questions: string[];
};

export async function fetchRecommendedBooks(
  prompt: string,
  limit = 6,
  context?: {
    clubId?: string;
    currentBookId?: string | null;
    shelfFingerprint?: string;
    excludeBookIds?: string[];
    qualityMode?: "fast" | "full";
    hasExplicitPrompt?: boolean;
  }
): Promise<RecommendationResult> {
  const data = await requestJson<RecommendationResponse>(`${apiBaseUrl}/api/recommendations/books`, {
    method: "POST",
    body: JSON.stringify({
      prompt,
      limit,
      clubId: context?.clubId,
      currentBookId: context?.currentBookId ?? null,
      shelfFingerprint: context?.shelfFingerprint,
      excludeBookIds: context?.excludeBookIds ?? [],
      qualityMode: context?.qualityMode ?? "fast",
      hasExplicitPrompt: context?.hasExplicitPrompt ?? false,
    }),
  });

  return {
    recommendations: data.books.map((book) => {
      const summary = pickDisplaySummary({
        synopsis: book.synopsis,
        description: book.description,
        fallback: "Recommended from the book catalog.",
      });

      return {
        id: book.id,
        title: book.title,
        author: book.author,
        genre: normalizeGenreLabel(book.genre),
        note: summary.note,
        description: summary.description,
        synopsis: summary.synopsis,
        coverImageUrl: getBookCoverUrl({
          title: book.title,
          author: book.author,
          coverImageUrl: book.coverImageUrl ?? null,
        }),
        matchReason:
          data.searchPlan.explanation ||
          `Matched from ${data.searchPlan.source || "assistant"} recommendation search.`,
      };
    }),
    explanation:
      data.searchPlan.explanation ||
      `Matched from ${data.searchPlan.source || "assistant"} recommendation search.`,
    source: data.searchPlan.source || "fallback",
    query: data.searchPlan.query,
  };
}

export async function fetchDiscussionQuestions(input: {
  title: string;
  author?: string;
  description?: string;
  clubName?: string;
  clubVibe?: string;
}): Promise<string[]> {
  const data = await requestJson<DiscussionQuestionsResponse>(`${apiBaseUrl}/api/recommendations/discussion-questions`, {
    method: "POST",
    body: JSON.stringify(input),
  });

  return Array.isArray(data.questions) ? data.questions.map((question) => String(question).trim()).filter(Boolean).slice(0, 5) : [];
}
