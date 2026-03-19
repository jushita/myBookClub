import { listBooks } from "../repositories/books.js";
import type { Book } from "../domain/entities/Book.js";
import { Book as BookEntity } from "../domain/entities/Book.js";
import { searchBooksWithFallback } from "./bookLookup.js";
import { embedTextWithOllama } from "./embeddings.js";

type BookSearchPlan = {
  rawPrompt: string;
  normalizedPrompt: string;
  query: string;
  openLibraryQuery: string;
  genres: string[];
  moods: string[];
  seasonalContext: string[];
  excludeTerms: string[];
  similarTo: string[];
  popularityIntent: "none" | "popular" | "top-charts";
  recencyPreference: "none" | "modern" | "recent";
  explanation: string;
  source: "ollama" | "fallback";
};

type RecommendationResponse = {
  searchPlan: BookSearchPlan;
  books: Book[];
};

type DiscussionQuestionRequest = {
  title: string;
  author?: string;
  description?: string;
  clubName?: string;
  clubVibe?: string;
};

type ClubTasteInsightRequest = {
  clubName: string;
  clubVibe?: string;
  memberCount: number;
  currentReadTitle?: string;
  currentReadAuthor?: string;
  savedTitles: string[];
  finishedTitles: string[];
  topGenres: string[];
  topAuthors: string[];
};

type ClubTasteInsight = {
  headline: string;
  summary: string;
  signals: string[];
  source: "ollama" | "fallback";
};

type OllamaParseResult = {
  query?: string;
  openLibraryQuery?: string;
  genres?: string[];
  moods?: string[];
  seasonalContext?: string[];
  excludeTerms?: string[];
  similarTo?: string[];
  popularityIntent?: "none" | "popular" | "top-charts";
  recencyPreference?: "none" | "modern" | "recent";
  explanation?: string;
};

const KNOWN_GENRES = [
  "romance",
  "horror",
  "thriller",
  "mystery",
  "fantasy",
  "science fiction",
  "sci-fi",
  "literary",
  "historical fiction",
  "historical",
  "young adult",
  "ya",
  "memoir",
  "nonfiction",
  "contemporary",
  "dystopian",
  "paranormal",
  "cozy mystery",
];

const SEASON_TERMS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "winter",
  "spring",
  "summer",
  "fall",
  "autumn",
  "valentine",
  "halloween",
  "christmas",
];

function normalizeList(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean)));
}

function normalizeInsightText(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => normalizeInsightText(item, ""))
      .filter(Boolean)
      .join(", ")
      .trim();
    return joined || fallback;
  }

  if (value && typeof value === "object") {
    const text = Object.values(value as Record<string, unknown>)
      .map((item) => normalizeInsightText(item, ""))
      .filter(Boolean)
      .join(" ")
      .trim();
    return text || fallback;
  }

  if (value == null) {
    return fallback;
  }

  const text = String(value).trim();
  return text && text !== "[object Object]" ? text : fallback;
}

function buildFallbackPlan(prompt: string): BookSearchPlan {
  const normalizedPrompt = prompt.trim().toLowerCase();
  const genres = KNOWN_GENRES.filter((genre) => normalizedPrompt.includes(genre));
  const seasonalContext = SEASON_TERMS.filter((term) => normalizedPrompt.includes(term));
  const moods = ["cozy", "dark", "warm", "gothic", "funny", "emotional", "spicy", "atmospheric"].filter((term) =>
    normalizedPrompt.includes(term)
  );
  const excludeTerms = ["poetry", "collected works", "reference", "manual", "guide", "anthology"];
  const popularityIntent =
    normalizedPrompt.includes("top charts") ||
    normalizedPrompt.includes("top chart") ||
    normalizedPrompt.includes("charts") ||
    normalizedPrompt.includes("charting") ||
    normalizedPrompt.includes("trending")
    ? "top-charts"
    : normalizedPrompt.includes("popular") || normalizedPrompt.includes("bestseller") || normalizedPrompt.includes("best seller")
      ? "popular"
      : "none";
  const recencyPreference =
    /\b202\d\b/.test(normalizedPrompt) ||
    normalizedPrompt.includes("new release") ||
    normalizedPrompt.includes("latest") ||
    normalizedPrompt.includes("this year") ||
    normalizedPrompt.includes("recent")
    ? "recent"
    : normalizedPrompt.includes("modern")
      ? "modern"
      : "none";
  const similarToMatch = prompt.match(/like\s+(.+)$/i);
  const similarTo = similarToMatch ? [similarToMatch[1].trim().toLowerCase()] : [];
  const openLibraryQuery =
    [...genres, ...moods, ...seasonalContext, popularityIntent === "top-charts" ? "bestseller" : ""]
      .filter(Boolean)
      .join(" ")
      .trim() || prompt.trim();

  return {
    rawPrompt: prompt,
    normalizedPrompt,
    query: prompt.trim(),
    openLibraryQuery,
    genres,
    moods,
    seasonalContext,
    excludeTerms,
    similarTo,
    popularityIntent,
    recencyPreference,
    explanation: genres.length > 0
      ? `Parsed genres ${genres.join(", ")} from the reader request.`
      : "Used the full reader prompt as a broad search query.",
    source: "fallback",
  };
}

async function parsePromptWithOllama(prompt: string): Promise<OllamaParseResult | null> {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL?.trim() || "llama3.1:8b";

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      prompt: [
        "You convert book recommendation prompts into a compact JSON search plan.",
        "Return only JSON with keys: query, openLibraryQuery, genres, moods, seasonalContext, excludeTerms, similarTo, popularityIntent, recencyPreference, explanation.",
        "query is for searching a local catalog and can keep some natural language.",
        "openLibraryQuery must be a compact keyword query for Open Library search, not a full conversational sentence.",
        "Example: 'i want to read a romance horror for february' -> openLibraryQuery: 'romance horror gothic valentine'.",
        "Set popularityIntent to one of: none, popular, top-charts.",
        "Set recencyPreference to one of: none, modern, recent.",
        "If the prompt mentions top charts, charting, trending, or bestseller-like popularity, popularityIntent must be top-charts unless the request clearly says otherwise.",
        "If the prompt mentions 2026, 2025, this year, latest, recent, or new release, recencyPreference must be recent.",
        "excludeTerms should include things like poetry, collected works, anthology, reference if the user wants mainstream chart-like books.",
        "similarTo should capture referenced books or authors after phrases like 'like ...'.",
        "genres/moods/seasonalContext must be arrays of lowercase strings.",
        `User prompt: ${prompt}`,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const data = (await response.json()) as { response?: string };

  if (!data.response) {
    return null;
  }

  return JSON.parse(data.response) as OllamaParseResult;
}

async function generateDiscussionQuestionsWithOllama(input: DiscussionQuestionRequest): Promise<string[] | null> {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL?.trim() || "llama3.1:8b";

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      prompt: [
        "You write book-club discussion questions.",
        "Return only JSON with a single key named questions.",
        "questions must be an array of exactly 5 distinct questions.",
        "Write questions that are specific, conversational, and good for a live club discussion.",
        "Do not number the questions.",
        `Book title: ${input.title}`,
        `Author: ${input.author || "Unknown author"}`,
        `Description: ${input.description || "No description provided."}`,
        `Club name: ${input.clubName || "Book club"}`,
        `Club vibe: ${input.clubVibe || "thoughtful"}`,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const data = (await response.json()) as { response?: string };

  if (!data.response) {
    return null;
  }

  const parsed = JSON.parse(data.response) as { questions?: unknown };

  if (!Array.isArray(parsed.questions)) {
    return null;
  }

  const questions = parsed.questions
    .map((value) => String(value).trim())
    .filter(Boolean)
    .slice(0, 5);

  return questions.length === 5 ? questions : null;
}

function buildFallbackDiscussionQuestions(input: DiscussionQuestionRequest): string[] {
  const authorLabel = input.author?.trim() || "the author";
  const clubLabel = input.clubName?.trim() || "this club";
  const vibeLabel = input.clubVibe?.trim().toLowerCase() || "thoughtful";

  return [
    `What was your first reaction to ${input.title}, and did that change by the end?`,
    `Which character decision or relationship in ${input.title} stood out most to the group, and why?`,
    `How did ${authorLabel} shape the mood or tension in a way that fit ${clubLabel}'s reading style?`,
    `What theme or question from ${input.title} feels most worth unpacking with a ${vibeLabel} discussion group?`,
    `If you were recommending ${input.title} to another club member, what would be the strongest reason to pick it up?`,
  ];
}

export async function generateDiscussionQuestions(input: DiscussionQuestionRequest): Promise<string[]> {
  try {
    const generated = await generateDiscussionQuestionsWithOllama(input);

    if (generated && generated.length === 5) {
      return generated;
    }
  } catch {
    // Fall back to deterministic questions when the model is unavailable.
  }

  return buildFallbackDiscussionQuestions(input);
}

async function generateClubTasteInsightWithOllama(input: ClubTasteInsightRequest): Promise<ClubTasteInsight | null> {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL?.trim() || "llama3.1:8b";

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      prompt: [
        "You summarize a book club's taste using real reading data.",
        "Return only JSON with keys: headline, summary, signals.",
        "headline should be 2 to 5 words and feel like a club taste label.",
        "summary should be one sentence, concrete and readable.",
        "signals must be an array of exactly 3 short observations grounded in the data.",
        `Club name: ${input.clubName}`,
        `Club vibe: ${input.clubVibe || "No explicit vibe provided"}`,
        `Member count: ${input.memberCount}`,
        `Current read: ${input.currentReadTitle ? `${input.currentReadTitle} by ${input.currentReadAuthor || "Unknown author"}` : "None"}`,
        `Saved titles: ${input.savedTitles.join(", ") || "None"}`,
        `Finished titles: ${input.finishedTitles.join(", ") || "None"}`,
        `Top genres: ${input.topGenres.join(", ") || "None"}`,
        `Top authors: ${input.topAuthors.join(", ") || "None"}`,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const data = (await response.json()) as { response?: string };

  if (!data.response) {
    return null;
  }

  const parsed = JSON.parse(data.response) as { headline?: unknown; summary?: unknown; signals?: unknown };

  if (!Array.isArray(parsed.signals)) {
    return null;
  }

  const signals = parsed.signals.map((value) => normalizeInsightText(value, "")).filter(Boolean).slice(0, 3);

  if (!parsed.headline || !parsed.summary || signals.length === 0) {
    return null;
  }

  return {
    headline: normalizeInsightText(parsed.headline, "Club taste snapshot"),
    summary: normalizeInsightText(parsed.summary, "The club insight is still warming up."),
    signals,
    source: "ollama",
  };
}

function buildFallbackClubTasteInsight(input: ClubTasteInsightRequest): ClubTasteInsight {
  const headline = input.topGenres.length > 0 ? `${input.topGenres[0]} loyalists` : "Club taste snapshot";
  const currentRead = input.currentReadTitle
    ? `Right now the club is orbiting around ${input.currentReadTitle}`
    : "The shelf is still forming its next obsession";
  const genreSignal =
    input.topGenres.length > 0
      ? `The shelf leans most toward ${input.topGenres.slice(0, 2).join(" and ")} picks.`
      : "The shelf is still broad enough that no single genre dominates yet.";
  const finishSignal =
    input.finishedTitles.length > 0
      ? `${input.finishedTitles.length} finished club reads are already shaping repeat taste patterns.`
      : "Finished-book history is still light, so the taste profile is being driven by the active shelf.";
  const authorSignal =
    input.topAuthors.length > 0
      ? `Recurring author energy: ${input.topAuthors.slice(0, 2).join(", ")}.`
      : "The club is still sampling widely rather than locking into one author lane.";

  return {
    headline,
    summary: `${currentRead}, with ${input.memberCount} readers pulling the club toward ${input.clubVibe?.toLowerCase() || "a shared reading mood"}.`,
    signals: [genreSignal, finishSignal, authorSignal],
    source: "fallback",
  };
}

export async function generateClubTasteInsight(input: ClubTasteInsightRequest): Promise<ClubTasteInsight> {
  try {
    const generated = await generateClubTasteInsightWithOllama(input);
    if (generated) {
      return generated;
    }
  } catch {
    // Fall back to deterministic summary when Ollama is unavailable.
  }

  return buildFallbackClubTasteInsight(input);
}

async function buildSearchPlan(prompt: string): Promise<BookSearchPlan> {
  const normalizedPrompt = prompt.trim().toLowerCase();

  if (!normalizedPrompt) {
    return {
      rawPrompt: prompt,
      normalizedPrompt,
      query: "",
      openLibraryQuery: "",
      genres: [],
      moods: [],
      seasonalContext: [],
      excludeTerms: [],
      similarTo: [],
      popularityIntent: "none",
      recencyPreference: "none",
      explanation: "No prompt supplied, so the catalog will use broad matching.",
      source: "fallback",
    };
  }

  try {
    const result = await parsePromptWithOllama(prompt);

    if (!result) {
      return buildFallbackPlan(prompt);
    }

    return {
      rawPrompt: prompt,
      normalizedPrompt,
      query: (result.query || prompt).trim(),
      openLibraryQuery: (result.openLibraryQuery || result.query || prompt).trim(),
      genres: normalizeList(result.genres),
      moods: normalizeList(result.moods),
      seasonalContext: normalizeList(result.seasonalContext),
      excludeTerms: normalizeList(result.excludeTerms),
      similarTo: normalizeList(result.similarTo),
      popularityIntent: result.popularityIntent || "none",
      recencyPreference: result.recencyPreference || "none",
      explanation: result.explanation?.trim() || "Generated a search plan from the reader request.",
      source: "ollama",
    };
  } catch {
    return buildFallbackPlan(prompt);
  }
}

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  subject?: string[];
  cover_i?: number;
  first_publish_year?: number;
  ratings_count?: number;
  ratings_average?: number;
  readinglog_count?: number;
  want_to_read_count?: number;
  already_read_count?: number;
  edition_count?: number;
};

function buildOpenLibraryBlurb(doc: OpenLibraryDoc): string {
  const author = doc.author_name?.[0] ?? "an unknown author";
  const subjects = (doc.subject ?? [])
    .map((subject) => subject.trim())
    .filter(Boolean)
    .filter((subject, index, all) => all.findIndex((value) => value.toLowerCase() === subject.toLowerCase()) === index)
    .slice(0, 3);
  const year = doc.first_publish_year ? ` First published in ${doc.first_publish_year}.` : "";

  if (subjects.length === 0) {
    return `A book by ${author}.${year}`.trim();
  }

  if (subjects.length === 1) {
    return `A ${subjects[0].toLowerCase()}-leaning pick by ${author}.${year}`.trim();
  }

  if (subjects.length === 2) {
    return `A ${subjects[0].toLowerCase()} and ${subjects[1].toLowerCase()} read by ${author}.${year}`.trim();
  }

  return `A ${subjects[0].toLowerCase()}, ${subjects[1].toLowerCase()}, and ${subjects[2].toLowerCase()} pick by ${author}.${year}`.trim();
}

function normalizeComparisonText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSimilarityExclusions(plan: BookSearchPlan): string[] {
  return plan.similarTo
    .map((value) => normalizeComparisonText(value))
    .filter((value) => value.length >= 4);
}

function looksLikeSimilaritySeed(candidate: string, exclusions: string[]): boolean {
  const normalizedCandidate = normalizeComparisonText(candidate);

  if (!normalizedCandidate) {
    return false;
  }

  return exclusions.some((seed) => {
    if (normalizedCandidate === seed) {
      return true;
    }

    if (normalizedCandidate.includes(seed)) {
      return true;
    }

    const seedTokens = seed.split(" ").filter((token) => token.length >= 3);
    if (seedTokens.length === 0) {
      return false;
    }

    return seedTokens.every((token) => normalizedCandidate.includes(token));
  });
}

function filterAndRankOpenLibraryDocs(plan: BookSearchPlan, docs: OpenLibraryDoc[], limit: number): Book[] {
  const genreTerms = plan.genres;
  const moodTerms = plan.moods;
  const seasonalTerms = plan.seasonalContext;
  const excludeTerms = [...plan.excludeTerms];
  const similarityExclusions = buildSimilarityExclusions(plan);

  return docs
    .filter((doc) => doc.key && doc.title)
    .filter((doc) => {
      const title = (doc.title ?? "").toLowerCase();
      const subjects = (doc.subject ?? []).map((subject) => subject.toLowerCase());
      const author = (doc.author_name?.[0] ?? "").toLowerCase();

      if (looksLikeSimilaritySeed(doc.title ?? "", similarityExclusions)) {
        return false;
      }

      const blockedTerms = [
        "film",
        "catalog",
        "guide",
        "directory",
        "manual",
        "reference",
        "poems",
        "poetry",
        "complete works",
        "selections",
        "collected",
        "stories and poems",
        "volume",
        "works (",
        ...excludeTerms,
      ];

      const looksNonBookish = blockedTerms.some(
        (term) => title.includes(term) || author.includes(term) || subjects.some((subject) => subject.includes(term))
      );

      if (looksNonBookish && genreTerms.length > 0) {
        return false;
      }

      if (genreTerms.length === 0) {
        return true;
      }

      return genreTerms.some((genre) => subjects.some((subject) => subject.includes(genre)));
    })
    .sort((left, right) => {
      const scoreDoc = (doc: OpenLibraryDoc) => {
        const haystack = [doc.title ?? "", ...(doc.author_name ?? []), ...(doc.subject ?? [])]
          .join(" ")
          .toLowerCase();
        let score = 0;

        for (const genre of genreTerms) {
          if (haystack.includes(genre)) {
            score += 5;
          }
        }

        for (const mood of moodTerms) {
          if (haystack.includes(mood)) {
            score += 2;
          }
        }

        for (const season of seasonalTerms) {
          if (haystack.includes(season)) {
            score += 1;
          }
        }

        if (doc.cover_i) {
          score += 2;
        }

        score += Math.min((doc.readinglog_count ?? 0) / 200, 8);
        score += Math.min((doc.want_to_read_count ?? 0) / 200, 6);
        score += Math.min((doc.ratings_count ?? 0) / 100, 6);
        score += Math.min((doc.ratings_average ?? 0) * 0.8, 4);
        score += Math.min((doc.edition_count ?? 0) / 50, 2);
        score += Math.min((doc.already_read_count ?? 0) / 200, 3);

        if (plan.popularityIntent === "top-charts") {
          score += Math.min((doc.readinglog_count ?? 0) / 100, 8);
          score += Math.min((doc.want_to_read_count ?? 0) / 100, 6);
        } else if (plan.popularityIntent === "popular") {
          score += Math.min((doc.readinglog_count ?? 0) / 150, 5);
        }

        if (plan.recencyPreference === "recent" && doc.first_publish_year) {
          if (doc.first_publish_year >= 2020) {
            score += 14;
          } else if (doc.first_publish_year >= 2018) {
            score += 10;
          } else if (doc.first_publish_year >= 2015) {
            score += 5;
          } else if (doc.first_publish_year >= 2010) {
            score += 1;
          } else if (doc.first_publish_year < 2000) {
            score -= 10;
          } else if (doc.first_publish_year < 2010) {
            score -= 5;
          }
        } else if (plan.recencyPreference === "modern" && doc.first_publish_year) {
          if (doc.first_publish_year >= 2010) {
            score += 6;
          } else if (doc.first_publish_year >= 2000) {
            score += 3;
          } else if (doc.first_publish_year < 2000) {
            score -= 8;
          }
        }

        if (plan.popularityIntent === "top-charts" && plan.recencyPreference !== "none" && doc.first_publish_year) {
          if (doc.first_publish_year < 2000) {
            score -= 12;
          } else if (doc.first_publish_year < 2010) {
            score -= 6;
          }
        }

        const title = (doc.title ?? "").toLowerCase();
        if (title.includes("a novel") || title.includes("novel")) {
          score += 2;
        }

        for (const similar of plan.similarTo) {
          if (haystack.includes(similar) && !looksLikeSimilaritySeed(doc.title ?? "", similarityExclusions)) {
            score += 2;
          }
        }

        return score;
      };

      return scoreDoc(right) - scoreDoc(left);
    })
    .slice(0, limit)
    .map(
      (doc, index) =>
        new BookEntity({
          id: `openlibrary:${doc.key ?? index}`,
          title: doc.title ?? "Unknown title",
          author: doc.author_name?.[0] ?? "Unknown author",
          genre: (doc.subject ?? []).slice(0, 3).join(", "),
          description: buildOpenLibraryBlurb(doc),
          synopsis: buildOpenLibraryBlurb(doc),
          coverImageUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
          publishedAt: doc.first_publish_year ? new Date(`${doc.first_publish_year}-01-01`) : null,
        })
    );
}

async function fetchOpenLibraryBooks(plan: BookSearchPlan, limit: number): Promise<Book[]> {
  const compactQuery = buildOpenLibraryQuery(plan);
  const queries = [
    compactQuery ? `${compactQuery} readinglog_count:[25 TO *]` : "",
    compactQuery,
    plan.genres.join(" "),
    plan.query,
    plan.rawPrompt,
  ].filter(Boolean);

  for (const query of queries) {
    const params = new URLSearchParams({
      q: query,
      limit: String(Math.min(Math.max(limit * 3, 10), 30)),
      fields:
        "key,title,author_name,subject,cover_i,first_publish_year,ratings_count,ratings_average,readinglog_count,want_to_read_count,already_read_count,edition_count",
    });

    const response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Open Library returned ${response.status}`);
    }

    const data = (await response.json()) as { docs?: OpenLibraryDoc[] };
    const rankedBooks = filterAndRankOpenLibraryDocs(plan, data.docs ?? [], limit);

    if (rankedBooks.length > 0) {
      return rankedBooks;
    }
  }

  return [];
}

function buildRepositoryQuery(plan: BookSearchPlan): string {
  return [plan.query, ...plan.moods, ...plan.seasonalContext, ...plan.similarTo].filter(Boolean).join(" ").trim();
}

function buildOpenLibraryQuery(plan: BookSearchPlan): string {
  const normalizedPrompt = plan.normalizedPrompt;
  if (plan.similarTo.length > 0) {
    const seedTerms = plan.similarTo.flatMap((value) => value.split(/\s+/)).filter((token) => token.length >= 3);
    const queryTerms = plan.openLibraryQuery
      .split(/\s+/)
      .filter((token) => token.length >= 2)
      .filter((token) => !seedTerms.includes(token.toLowerCase()));

    const fallbackTerms = [...plan.genres, ...plan.moods, ...plan.seasonalContext].filter(Boolean);
    const highLevelTerms = queryTerms.filter(
      (token) =>
        !normalizedPrompt.includes(`like ${token.toLowerCase()}`) &&
        !["book", "books", "novel", "novels", "author"].includes(token.toLowerCase())
    );

    const similarityQuery = [...highLevelTerms, ...fallbackTerms].filter(Boolean).join(" ").trim();
    if (similarityQuery) {
      return similarityQuery;
    }
  }

  return (
    plan.openLibraryQuery.trim() ||
    [...plan.genres, ...plan.moods, ...plan.seasonalContext].filter(Boolean).join(" ").trim() ||
    plan.query
  );
}

type RerankResult = {
  orderedIds?: string[];
  reasoning?: string;
};

async function rerankBooksWithOllama(prompt: string, plan: BookSearchPlan, books: Book[], limit: number): Promise<Book[]> {
  if (books.length <= 1 || plan.source !== "ollama") {
    return books.slice(0, limit);
  }

  const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL?.trim() || "llama3.1:8b";
  const similarityExclusions = buildSimilarityExclusions(plan);
  const candidates = books
    .filter((book) => !looksLikeSimilaritySeed(book.title, similarityExclusions))
    .slice(0, Math.min(books.length, 10));

  if (candidates.length <= 1) {
    return candidates.slice(0, limit);
  }

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        prompt: [
          "You rerank candidate books for a user request.",
          "Return only JSON with keys: orderedIds, reasoning.",
          `User prompt: ${prompt}`,
          `Search plan: ${JSON.stringify(plan)}`,
          `Candidates: ${JSON.stringify(
            candidates.map((book) => ({
              id: book.id,
              title: book.title,
              author: book.author,
              genre: book.genre,
              synopsis: book.synopsis,
              description: book.description,
              publishedAt: book.publishedAt,
            }))
          )}`,
        ].join("\n"),
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama rerank returned ${response.status}`);
    }

    const data = (await response.json()) as { response?: string };
    if (!data.response) {
      return candidates.slice(0, limit);
    }

    const rerank = JSON.parse(data.response) as RerankResult;
    const orderedIds = rerank.orderedIds ?? [];
    const booksById = new Map(candidates.map((book) => [book.id, book]));
    const orderedBooks = orderedIds.map((id) => booksById.get(id)).filter((book): book is Book => Boolean(book));
    const remainingBooks = candidates.filter((book) => !orderedIds.includes(book.id));

    return [...orderedBooks, ...remainingBooks].slice(0, limit);
  } catch {
    return candidates.slice(0, limit);
  }
}

function rankBooks(books: Book[], plan: BookSearchPlan): Book[] {
  const similarityExclusions = buildSimilarityExclusions(plan);

  const scoreBook = (book: Book) => {
    if (looksLikeSimilaritySeed(book.title, similarityExclusions)) {
      return Number.NEGATIVE_INFINITY;
    }

    const haystack = [book.title, book.author, book.genre, book.description, book.synopsis].join(" ").toLowerCase();
    let score = 0;

    for (const genre of plan.genres) {
      if (haystack.includes(genre)) {
        score += 4;
      }
    }

    for (const mood of plan.moods) {
      if (haystack.includes(mood)) {
        score += 2;
      }
    }

    for (const season of plan.seasonalContext) {
      if (haystack.includes(season)) {
        score += 2;
      }
    }

    for (const token of plan.query.split(/\s+/).filter((token) => token.length > 2)) {
      if (haystack.includes(token.toLowerCase())) {
        score += 1;
      }
    }

    return score;
  };

  return [...books]
    .filter((book) => !looksLikeSimilaritySeed(book.title, similarityExclusions))
    .sort((a, b) => scoreBook(b) - scoreBook(a));
}

export async function recommendBooksFromPrompt(prompt: string, limit = 8): Promise<RecommendationResponse> {
  const fastSearchPlan = buildFallbackPlan(prompt);
  const queryEmbedding = await embedTextWithOllama(prompt).catch(() => null);
  const fastLocalBooks = await listBooks({
    query: buildRepositoryQuery(fastSearchPlan) || prompt.trim() || undefined,
    genres: fastSearchPlan.genres,
    embedding: queryEmbedding?.embedding ?? null,
    limit: Math.max(limit * 4, 20),
  });
  const rankedFastLocalBooks = rankBooks(fastLocalBooks, fastSearchPlan).slice(0, limit);

  if (rankedFastLocalBooks.length >= Math.min(limit, 3)) {
    return {
      searchPlan: {
        ...fastSearchPlan,
        explanation: "Used the local catalog with semantic retrieval for a fast recommendation pass.",
      },
      books: rankedFastLocalBooks,
    };
  }

  const searchPlan = await buildSearchPlan(prompt);
  const localBooks = await listBooks({
    query: buildRepositoryQuery(searchPlan) || undefined,
    genres: searchPlan.genres,
    embedding: queryEmbedding?.embedding ?? null,
    limit: Math.max(limit * 3, 12),
  });
  const rankedLocalBooks = rankBooks(localBooks, searchPlan).slice(0, limit);

  if (rankedLocalBooks.length > 0) {
    return {
      searchPlan,
      books: rankedLocalBooks,
    };
  }

  try {
    const openLibraryBooks = await searchBooksWithFallback(
      {
        query: buildOpenLibraryQuery(searchPlan) || searchPlan.query,
        genre: searchPlan.genres[0],
        limit,
      },
      await fetchOpenLibraryBooks(searchPlan, limit)
    );

    return {
      searchPlan: {
        ...searchPlan,
        explanation: `${searchPlan.explanation} No local matches were found, so results were fetched from Open Library.`,
      },
      books: openLibraryBooks.slice(0, limit),
    };
  } catch {
    return {
      searchPlan,
      books: [],
    };
  }
}
