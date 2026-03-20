import { Router } from "express";
import crypto from "node:crypto";
import type { Request, Response } from "express";
import { findRecommendationCache, upsertRecommendationCache } from "../repositories/recommendationCache.js";
import { generateDiscussionQuestions, recommendBooksFromPrompt } from "../services/bookAssistant.js";

type RecommendBooksBody = {
  prompt?: string;
  limit?: number;
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

function buildPromptKey(prompt: string, limit: number) {
  const normalizedPrompt = prompt.trim().toLowerCase().replace(/\s+/g, " ");
  const promptKey = crypto.createHash("sha256").update(`${limit}:${normalizedPrompt}`).digest("hex");

  return {
    normalizedPrompt,
    promptKey,
  };
}

recommendationsRouter.post(
  "/books",
  async (req: Request<unknown, unknown, RecommendBooksBody>, res: Response) => {
    try {
      const prompt = String(req.body?.prompt || "").trim();
      const limit = Number(req.body?.limit || 8);

      if (!prompt) {
        res.status(400).json({ error: "prompt is required" });
        return;
      }

      const { normalizedPrompt, promptKey } = buildPromptKey(prompt, limit);
      const cached = await findRecommendationCache(promptKey);

      if (cached) {
        res.json({
          searchPlan: cached.searchPlan,
          books: cached.books,
        });
        return;
      }

      const result = await recommendBooksFromPrompt(prompt, limit);

      await upsertRecommendationCache({
        id: `rc${Date.now()}`,
        promptKey,
        normalizedPrompt,
        resultLimit: limit,
        searchPlan: result.searchPlan as unknown as Record<string, unknown>,
        books: result.books.map((book) => book.toJSON()) as unknown as Record<string, unknown>[],
      });

      res.json({
        searchPlan: result.searchPlan,
        books: result.books.map((book) => book.toJSON()),
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
