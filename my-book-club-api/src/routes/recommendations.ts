import { Router } from "express";
import crypto from "node:crypto";
import type { Request, Response } from "express";
import { Book as BookEntity } from "../domain/entities/index.js";
import { upsertBook } from "../repositories/books.js";
import { findRecommendationCache, upsertRecommendationCache } from "../repositories/recommendationCache.js";
import { queueBooksForBackgroundEmbedding } from "../services/bookEmbeddingQueue.js";
import { dedupeBooksByCompleteness } from "../services/bookDeduplication.js";
import { getCachedJson, setCachedJson } from "../services/cache.js";
import { generateDiscussionQuestions, recommendBooksFromPrompt } from "../services/bookAssistant.js";

type RecommendBooksBody = {
  prompt?: string;
  limit?: number;
  clubId?: string;
  currentBookId?: string | null;
  shelfFingerprint?: string;
  excludeBookIds?: string[];
  qualityMode?: "fast" | "full";
  hasExplicitPrompt?: boolean;
  debug?: boolean;
};

type DiscussionQuestionsBody = {
  title?: string;
  author?: string;
  description?: string;
  genres?: string;
  clubName?: string;
  clubVibe?: string;
};

export const recommendationsRouter = Router();
const RECOMMENDATION_CACHE_TTL_SECONDS = 60 * 10;
const RECOMMENDATION_POOL_SIZE = 24;
const RECOMMENDATION_CACHE_VERSION = "v7";

function buildDebugPayload(input: {
  prompt: string;
  promptKey: string;
  poolSize: number;
  limit: number;
  excludeBookIds: string[];
  hasExplicitPrompt: boolean;
  qualityMode?: "fast" | "full";
  cacheSource: "redis" | "postgres" | "generated";
  totalPoolBooks: number;
  searchPlan: Record<string, unknown>;
  books: Array<{ title?: unknown; id?: unknown }>;
}) {
  return {
    prompt: input.prompt,
    promptKey: input.promptKey,
    poolSize: input.poolSize,
    limit: input.limit,
    excludeBookIds: input.excludeBookIds,
    hasExplicitPrompt: input.hasExplicitPrompt,
    qualityMode: input.qualityMode ?? "fast",
    cacheSource: input.cacheSource,
    cacheVersion: RECOMMENDATION_CACHE_VERSION,
    totalPoolBooks: input.totalPoolBooks,
    searchPlan: input.searchPlan,
    returnedBookIds: input.books.map((book) => String(book.id || "")).filter(Boolean),
    returnedTitles: input.books.map((book) => String(book.title || "")).filter(Boolean),
  };
}

function normalizeContextToken(value: string | null | undefined, fallback = "none") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  return normalized || fallback;
}

function buildPromptKey(input: {
  prompt: string;
  poolSize: number;
  clubId?: string;
  currentBookId?: string | null;
  shelfFingerprint?: string;
}) {
  const normalizedPrompt = input.prompt.trim().toLowerCase().replace(/\s+/g, " ");
  const normalizedClubId = normalizeContextToken(input.clubId);
  const normalizedCurrentBookId = normalizeContextToken(input.currentBookId);
  const normalizedShelfFingerprint = normalizeContextToken(input.shelfFingerprint);
  const promptKey = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        cacheVersion: RECOMMENDATION_CACHE_VERSION,
        poolSize: input.poolSize,
        prompt: normalizedPrompt,
        clubId: normalizedClubId,
        currentBookId: normalizedCurrentBookId,
        shelfFingerprint: normalizedShelfFingerprint,
      })
    )
    .digest("hex");

  return {
    normalizedPrompt,
    promptKey,
  };
}

function dedupeBooks<T extends { id?: unknown; title?: unknown; author?: unknown; coverImageUrl?: unknown; description?: unknown; synopsis?: unknown }>(
  books: T[]
): T[] {
  return dedupeBooksByCompleteness(books).filter((book) => String(book?.id || "").trim().length > 0);
}

function selectRecommendationSlice<T extends { id?: unknown }>(books: T[], limit: number, excludeBookIds: string[]): T[] {
  const excluded = new Set(excludeBookIds.map((id) => String(id).trim()).filter(Boolean));
  const uniqueBooks = dedupeBooks(books);
  const unseenBooks = uniqueBooks.filter((book) => !excluded.has(String(book.id || "").trim()));
  return unseenBooks.slice(0, limit);
}

async function persistRecommendationBooks(books: Record<string, unknown>[]) {
  const persistedBooks = await Promise.all(
    books.map(async (book) => {
      try {
        return await upsertBook(new BookEntity(book as ConstructorParameters<typeof BookEntity>[0]));
      } catch {
        // Best-effort persistence so cache serving is never blocked by one bad row.
        return null;
      }
    })
  );

  queueBooksForBackgroundEmbedding(
    persistedBooks.filter((book): book is NonNullable<(typeof persistedBooks)[number]> => Boolean(book))
  );
}

function queueRecommendationArtifactsWrite(input: {
  redisKey: string;
  responsePayload: {
    searchPlan: Record<string, unknown>;
    books: Record<string, unknown>[];
  };
  promptKey?: string;
  normalizedPrompt?: string;
  poolSize?: number;
  persistBooks?: boolean;
}): void {
  void (async () => {
    const writeTasks: Promise<unknown>[] = [
      setCachedJson(input.redisKey, input.responsePayload, RECOMMENDATION_CACHE_TTL_SECONDS),
    ];

    if (input.persistBooks) {
      writeTasks.push(persistRecommendationBooks(input.responsePayload.books));
    }

    if (input.promptKey && input.normalizedPrompt && input.poolSize) {
      writeTasks.push(
        upsertRecommendationCache({
          id: `rc${Date.now()}`,
          promptKey: input.promptKey,
          normalizedPrompt: input.normalizedPrompt,
          resultLimit: input.poolSize,
          searchPlan: input.responsePayload.searchPlan,
          books: input.responsePayload.books,
        })
      );
    }

    await Promise.allSettled(writeTasks);
  })().catch((error) => {
    console.error("recommendation artifact write failed", error);
  });
}

async function buildRecommendationPool(input: {
  prompt: string;
  poolSize: number;
  excludeBookIds: string[];
  requestedQualityMode?: "fast" | "full";
  hasExplicitPrompt?: boolean;
}) {
  const accumulatedBooks: Record<string, unknown>[] = [];
  let latestSearchPlan: Record<string, unknown> = {};
  let previousCount = -1;

  const attemptModes: Array<"fast" | "full"> =
    input.requestedQualityMode === "full"
      ? ["full", "full", "full", "full"]
      : ["fast", "full", "full", "full"];

  for (const mode of attemptModes) {
    const result = await recommendBooksFromPrompt(input.prompt, input.poolSize, {
      mode,
      explicitPrompt: input.hasExplicitPrompt,
      excludeBookIds: [
        ...input.excludeBookIds,
        ...accumulatedBooks.map((book) => String(book.id || "").trim()).filter(Boolean),
      ],
    });

    latestSearchPlan = result.searchPlan as unknown as Record<string, unknown>;

    const nextBooks = dedupeBooks([
      ...accumulatedBooks,
      ...result.books.map((book) => book.toJSON()) as Record<string, unknown>[],
    ]).slice(0, input.poolSize);

    accumulatedBooks.splice(0, accumulatedBooks.length, ...nextBooks);

    if (accumulatedBooks.length >= input.poolSize) {
      break;
    }

    if (accumulatedBooks.length === previousCount) {
      break;
    }

    previousCount = accumulatedBooks.length;
  }

  return {
    searchPlan: latestSearchPlan,
    books: accumulatedBooks,
  };
}

recommendationsRouter.post(
  "/books",
  async (req: Request<unknown, unknown, RecommendBooksBody>, res: Response) => {
    try {
      const prompt = String(req.body?.prompt || "").trim();
      const limit = Number(req.body?.limit || 8);
      const poolSize = Math.max(limit, RECOMMENDATION_POOL_SIZE);
      const excludeBookIds = Array.isArray(req.body?.excludeBookIds)
        ? req.body.excludeBookIds.map((id) => String(id).trim()).filter(Boolean)
        : [];
      const hasExplicitPrompt = Boolean(req.body?.hasExplicitPrompt);
      const debug = Boolean(req.body?.debug);

      if (!prompt) {
        res.status(400).json({ error: "prompt is required" });
        return;
      }

      const { promptKey } = buildPromptKey({
        prompt,
        poolSize,
        clubId: req.body?.clubId,
        currentBookId: req.body?.currentBookId,
        shelfFingerprint: req.body?.shelfFingerprint,
      });
      const redisKey = `recommendations:${promptKey}`;
      const redisCached = await getCachedJson<{
        searchPlan: Record<string, unknown>;
        books: Record<string, unknown>[];
      }>(redisKey);

      if (redisCached) {
        const redisSlice = selectRecommendationSlice(redisCached.books, limit, excludeBookIds);
        if (redisSlice.length > 0) {
          res.json({
            searchPlan: redisCached.searchPlan,
            books: redisSlice,
            ...(debug
              ? {
                  debug: buildDebugPayload({
                    prompt,
                    promptKey,
                    poolSize,
                    limit,
                    excludeBookIds,
                    hasExplicitPrompt,
                    qualityMode: req.body?.qualityMode,
                    cacheSource: "redis",
                    totalPoolBooks: redisCached.books.length,
                    searchPlan: redisCached.searchPlan,
                    books: redisSlice,
                  }),
                }
              : {}),
          });
          return;
        }
      }

      const dbCached = await findRecommendationCache(promptKey);

      if (dbCached && Date.now() - dbCached.updatedAt.getTime() <= RECOMMENDATION_CACHE_TTL_SECONDS * 1000) {
        const dbSlice = selectRecommendationSlice(dbCached.books, limit, excludeBookIds);
        if (dbSlice.length > 0) {
          const responsePayload = {
            searchPlan: dbCached.searchPlan,
            books: dbCached.books,
          };

          queueRecommendationArtifactsWrite({
            redisKey,
            responsePayload,
          });

          res.json({
            searchPlan: dbCached.searchPlan,
            books: dbSlice,
            ...(debug
              ? {
                  debug: buildDebugPayload({
                    prompt,
                    promptKey,
                    poolSize,
                    limit,
                    excludeBookIds,
                    hasExplicitPrompt,
                    qualityMode: req.body?.qualityMode,
                    cacheSource: "postgres",
                    totalPoolBooks: dbCached.books.length,
                    searchPlan: dbCached.searchPlan,
                    books: dbSlice,
                  }),
                }
              : {}),
          });
          return;
        }
      }

      const generatedPool = await buildRecommendationPool({
        prompt,
        poolSize,
        excludeBookIds,
        requestedQualityMode: req.body?.qualityMode,
        hasExplicitPrompt: Boolean(req.body?.hasExplicitPrompt),
      });
      const mergedSearchPlan = generatedPool.searchPlan;
      const cachedBooks = generatedPool.books;

      const responsePayload = {
        searchPlan: mergedSearchPlan,
        books: cachedBooks,
      };
      const normalizedPrompt = prompt.trim().toLowerCase().replace(/\s+/g, " ");

      queueRecommendationArtifactsWrite({
        redisKey,
        responsePayload,
        promptKey,
        normalizedPrompt,
        poolSize,
        persistBooks: true,
      });

      res.json({
        searchPlan: mergedSearchPlan,
        books: selectRecommendationSlice(cachedBooks, limit, excludeBookIds),
        ...(debug
          ? {
              debug: buildDebugPayload({
                prompt,
                promptKey,
                poolSize,
                limit,
                excludeBookIds,
                hasExplicitPrompt,
                qualityMode: req.body?.qualityMode,
                cacheSource: "generated",
                totalPoolBooks: cachedBooks.length,
                searchPlan: mergedSearchPlan,
                books: selectRecommendationSlice(cachedBooks, limit, excludeBookIds),
              }),
            }
          : {}),
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "could not generate recommendations" });
    }
  }
);

recommendationsRouter.post(
  "/discussion-questions",
  async (req: Request<unknown, unknown, DiscussionQuestionsBody>, res: Response) => {
    try {
      const title = String(req.body?.title || "").trim();

      if (!title) {
        res.status(400).json({ error: "title is required" });
        return;
      }

      const questions = await generateDiscussionQuestions({
        title,
        author: req.body?.author?.trim(),
        description: req.body?.description?.trim(),
        genres: req.body?.genres
          ? String(req.body.genres)
              .split(/[,&/]/)
              .map((value) => value.trim())
              .filter(Boolean)
          : [],
        clubName: req.body?.clubName?.trim(),
        clubVibe: req.body?.clubVibe?.trim(),
      });

      res.json({ questions });
    } catch (error) {
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : "could not generate discussion questions" });
    }
  }
);
