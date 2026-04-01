import { listBooks, listBooksByAuthorSeeds, listBooksByTitleSeeds } from "../repositories/books.js";
import type { Book } from "../domain/entities/Book.js";
import { Book as BookEntity } from "../domain/entities/Book.js";
import { searchBooksWithFallback } from "./bookLookup.js";
import { dedupeBooksByCompleteness } from "./bookDeduplication.js";
import { embedTextWithOllama } from "./embeddings.js";

type BookSearchPlan = {
  intent: "broad-club-pick" | "author-expansion" | "exact-book" | "similar-book" | "theme-discovery";
  rawPrompt: string;
  normalizedPrompt: string;
  query: string;
  openLibraryQuery: string;
  authorSeeds: string[];
  titleSeeds: string[];
  themeSeeds: string[];
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

type BookSearchContext = {
  clubWantAuthors?: string[];
  clubWantGenres?: string[];
};

type RecommendationResponse = {
  searchPlan: BookSearchPlan;
  books: Book[];
};

type DiscussionQuestionRequest = {
  title: string;
  author?: string;
  description?: string;
  genres?: string[];
  clubName?: string;
  clubVibe?: string;
};

type ClubTasteInsightRequest = {
  clubName: string;
  clubVibe?: string;
  memberCount: number;
  memberNames: string[];
  currentReadTitle?: string;
  currentReadAuthor?: string;
  currentReadDescription?: string;
  savedTitles: string[];
  finishedTitles: string[];
  savedBookDetails: string[];
  finishedBookDetails: string[];
  topGenres: string[];
  topAuthors: string[];
};

type ClubTasteInsight = {
  headline: string;
  summary: string;
  source: "ollama" | "fallback";
};

function withPeriod(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function buildDirectClubSummary(input: ClubTasteInsightRequest): string {
  const currentRead = input.currentReadTitle
    ? `Right now you're clustering around ${input.currentReadTitle}`
    : "Your shelf is still choosing its next obsession";
  const vibe = input.clubVibe?.trim().toLowerCase() || "a distinct reading mood";

  return withPeriod(
    `${currentRead}, and with ${input.memberCount} readers in the mix, your club is giving off ${vibe} energy in a very convincing way`
  );
}

function formatList(values: string[], limit = 5): string {
  return values.slice(0, limit).join(", ") || "None";
}

function buildClubTasteContext(input: ClubTasteInsightRequest): string {
  const savedCount = input.savedTitles.length;
  const finishedCount = input.finishedTitles.length;
  const primaryGenre = input.topGenres[0] || "mixed taste";
  const secondaryGenre = input.topGenres[1] || "";
  const anchorAuthor = input.topAuthors[0] || "";

  return [
    `Club: ${input.clubName}`,
    `Club vibe: ${input.clubVibe || "No explicit vibe provided"}`,
    `Member count: ${input.memberCount}`,
    `Member names sample: ${formatList(input.memberNames, 6)}`,
    `Current read: ${input.currentReadTitle ? `${input.currentReadTitle} by ${input.currentReadAuthor || "Unknown author"}` : "None"}`,
    `Current read description: ${input.currentReadDescription || "None"}`,
    `Saved shelf count: ${savedCount}`,
    `Finished shelf count: ${finishedCount}`,
    `Saved titles sample: ${formatList(input.savedTitles, 8)}`,
    `Finished titles sample: ${formatList(input.finishedTitles, 8)}`,
    `Saved shelf detail sample: ${formatList(input.savedBookDetails, 8)}`,
    `Finished shelf detail sample: ${formatList(input.finishedBookDetails, 8)}`,
    `Top genres: ${formatList(input.topGenres, 6)}`,
    `Top authors: ${formatList(input.topAuthors, 6)}`,
    `Pattern hints: primary genre is ${primaryGenre}${secondaryGenre ? ` with ${secondaryGenre} also recurring` : ""}${anchorAuthor ? `; ${anchorAuthor} is a recurring author signal` : ""}.`,
  ].join("\n");
}

function buildClubInsightHeadline(input: ClubTasteInsightRequest): string {
  if (input.topGenres[0] && input.topAuthors[0]) {
    return `${input.topGenres[0]} instincts`;
  }

  if (input.topGenres[0]) {
    return `${input.topGenres[0]} shelf`;
  }

  if (input.currentReadTitle) {
    return "Current taste";
  }

  return "Taste snapshot";
}

type OllamaParseResult = {
  intent?: "broad-club-pick" | "author-expansion" | "exact-book" | "similar-book" | "theme-discovery";
  query?: string;
  openLibraryQuery?: string;
  authorSeeds?: string[];
  titleSeeds?: string[];
  themeSeeds?: string[];
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

function normalizePromptForGenreMatching(prompt: string): string {
  return prompt
    .replace(/\bsci[\s-]?fi\b/g, "science fiction")
    .replace(/\bya\b/g, "young adult");
}

function normalizeMatchText(value: string): string {
  return normalizePromptForGenreMatching(String(value || "").toLowerCase())
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeList(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean)));
}

function uniqueCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values.map((entry) => entry.trim()).filter(Boolean)) {
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(value);
  }

  return result;
}

function inferIntentFromPrompt(prompt: string, authorSeeds: string[], titleSeeds: string[], similarTo: string[]): BookSearchPlan["intent"] {
  const normalized = prompt.trim().toLowerCase();

  if (authorSeeds.length > 0 && /\b(more|another|books|author|similar author|same author)\b/.test(normalized)) {
    return "author-expansion";
  }

  if (titleSeeds.length > 0 && /\b(find|recommend|read|want)\b/.test(normalized) && !/\blike\b/.test(normalized)) {
    return "exact-book";
  }

  if (similarTo.length > 0 || /\blike\b/.test(normalized)) {
    return "similar-book";
  }

  if (KNOWN_GENRES.some((genre) => normalized.includes(genre))) {
    return "theme-discovery";
  }

  return "broad-club-pick";
}

function extractAuthorSeedsFromPrompt(prompt: string): string[] {
  const matches = Array.from(
    prompt.matchAll(/\b(?:more|by|like|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g)
  )
    .map((match) => match[1]?.trim() || "")
    .filter(Boolean);

  const trailingBooksMatch = prompt.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s+books\b/);
  if (trailingBooksMatch?.[1]) {
    matches.push(trailingBooksMatch[1].trim());
  }

  return uniqueCaseInsensitive(matches);
}

function cleanQueryTerms(query: string): string[] {
  const genericQueryTerms = new Set([
    "a",
    "an",
    "and",
    "author",
    "authors",
    "book",
    "books",
    "for",
    "i",
    "like",
    "more",
    "novel",
    "novels",
    "of",
    "read",
    "reading",
    "recommend",
    "recommendation",
    "similar",
    "some",
    "something",
    "that",
    "to",
    "want",
    "with",
  ]);

  return query
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !genericQueryTerms.has(token.toLowerCase()));
}

function buildLocalQuery(plan: Pick<BookSearchPlan, "intent" | "query" | "authorSeeds" | "titleSeeds" | "themeSeeds" | "similarTo">): string {
  const cleanedQueryTerms = cleanQueryTerms(plan.query);

  switch (plan.intent) {
    case "author-expansion":
      return uniqueCaseInsensitive([...plan.authorSeeds, ...plan.similarTo, ...cleanedQueryTerms]).join(" ").trim();
    case "exact-book":
      return uniqueCaseInsensitive([...plan.titleSeeds, ...plan.authorSeeds, ...cleanedQueryTerms]).join(" ").trim();
    case "similar-book":
      return uniqueCaseInsensitive([...plan.titleSeeds, ...plan.authorSeeds, ...plan.similarTo, ...plan.themeSeeds, ...cleanedQueryTerms])
        .join(" ")
        .trim();
    case "theme-discovery":
    case "broad-club-pick":
    default:
      return uniqueCaseInsensitive([...cleanedQueryTerms, ...plan.themeSeeds]).join(" ").trim();
  }
}

function buildOpenLibraryQueryFromIntent(
  plan: Pick<BookSearchPlan, "intent" | "query" | "openLibraryQuery" | "authorSeeds" | "titleSeeds" | "themeSeeds" | "recencyPreference" | "popularityIntent">
): string {
  const recentClause =
    plan.recencyPreference === "recent"
      ? " first_publish_year:[2015 TO *]"
      : plan.recencyPreference === "modern"
        ? " first_publish_year:[2000 TO *]"
        : "";

  switch (plan.intent) {
    case "author-expansion": {
      const authorPart = plan.authorSeeds.map((seed) => `author:"${seed}"`).join(" OR ");
      const themePart = plan.themeSeeds.slice(0, 2).join(" ");
      return `${authorPart}${themePart ? ` ${themePart}` : ""}${recentClause}`.trim();
    }
    case "exact-book": {
      const titlePart = plan.titleSeeds.map((seed) => `title:"${seed}"`).join(" OR ");
      const authorPart = plan.authorSeeds[0] ? ` author:"${plan.authorSeeds[0]}"` : "";
      return `${titlePart}${authorPart}`.trim() || plan.openLibraryQuery.trim() || plan.query.trim();
    }
    case "similar-book":
      return `${[...plan.titleSeeds, ...plan.authorSeeds, ...plan.themeSeeds].join(" ")}${recentClause}`.trim()
        || plan.openLibraryQuery.trim()
        || plan.query.trim();
    case "theme-discovery": {
      const themeTerms = uniqueCaseInsensitive(plan.themeSeeds.map((theme) => normalizeMatchText(theme)).filter(Boolean));
      if (themeTerms.length >= 2) {
        const themedQuery = themeTerms
          .map((theme) => {
            const aliases = uniqueCaseInsensitive(expandThemeAliases(theme));
            return aliases.length > 1
              ? `(${aliases.map((alias) => `subject:"${alias}"`).join(" OR ")})`
              : `subject:"${aliases[0]}"`;
          })
          .join(" AND ");

        return `${themedQuery}${recentClause}`.trim();
      }

      return `${plan.openLibraryQuery.trim() || [...plan.themeSeeds, ...cleanQueryTerms(plan.query)].join(" ").trim()}${recentClause}`.trim();
    }
    case "broad-club-pick":
    default:
      return `${plan.openLibraryQuery.trim() || [...plan.themeSeeds, ...cleanQueryTerms(plan.query)].join(" ").trim()}${recentClause}`.trim();
  }
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

function normalizeDiscussionQuestionText(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (Array.isArray(value)) {
    const joined = value
      .map((item) => normalizeDiscussionQuestionText(item, ""))
      .filter(Boolean)
      .join(" ")
      .trim();
    return joined || fallback;
  }

  if (value && typeof value === "object") {
    const text = Object.values(value as Record<string, unknown>)
      .map((item) => normalizeDiscussionQuestionText(item, ""))
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

function buildFallbackPlan(prompt: string, context: BookSearchContext = {}): BookSearchPlan {
  const normalizedPrompt = prompt.trim().toLowerCase();
  const normalizedForGenreMatching = normalizePromptForGenreMatching(normalizedPrompt);
  const genres = Array.from(new Set(KNOWN_GENRES.filter((genre) => normalizedForGenreMatching.includes(genre))));
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
  const similarTo = normalizeList(similarToMatch ? [similarToMatch[1].trim().toLowerCase()] : []);
  const authorSeeds = uniqueCaseInsensitive(
    [...extractAuthorSeedsFromPrompt(prompt), ...similarTo]
      .map((value) => String(value).trim())
      .filter((value) => value.split(/\s+/).length >= 2)
  );
  const titleSeeds: string[] = [];
  const themeSeeds = uniqueCaseInsensitive([...genres, ...moods, ...seasonalContext]);
  const intent = inferIntentFromPrompt(prompt, authorSeeds, titleSeeds, similarTo);
  const query = prompt.trim();
  const openLibraryQuery = buildOpenLibraryQueryFromIntent({
    intent,
    query,
    openLibraryQuery: query,
    authorSeeds,
    titleSeeds,
    themeSeeds,
    recencyPreference,
    popularityIntent,
  });

  return {
    intent,
    rawPrompt: prompt,
    normalizedPrompt,
    query,
    openLibraryQuery,
    authorSeeds,
    titleSeeds,
    themeSeeds,
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

async function parsePromptWithOllama(prompt: string, context: BookSearchContext = {}): Promise<OllamaParseResult | null> {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL?.trim() || "llama3.1:8b";
  const clubWantAuthors = normalizeList(context.clubWantAuthors);
  const clubWantGenres = normalizeList(context.clubWantGenres);

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
        "You are assisting in forming a book search query for the Open Library API.",
        "Return only JSON with keys: intent, query, openLibraryQuery, authorSeeds, titleSeeds, themeSeeds, genres, moods, seasonalContext, excludeTerms, similarTo, popularityIntent, recencyPreference, explanation.",
        "The book club has a 'want list' containing authors they like, themes or genres they prefer, and they want fresh recommendations.",
        "intent must be one of: broad-club-pick, author-expansion, exact-book, similar-book, theme-discovery.",
        "authorSeeds should contain concrete author names when the user asks for more books by or like an author.",
        "titleSeeds should contain concrete book titles when the user names a book.",
        "themeSeeds should contain compact lower-case themes or subgenres useful for both local retrieval and Open Library.",
        "If the user explicitly asks for one or more genres, genres should contain only those explicit genres and should not be broadened to adjacent categories.",
        "Create a query that prioritizes books with a rating of at least 4.0, focuses on recent releases, and highlights authors similar to those in the club's want list.",
        "Use the Open Library search fields like title, author, subject, or first_publish_year as needed.",
        "Structure openLibraryQuery as you would for Open Library API searches, making it concise and effective.",
        "query is for searching a local catalog and can keep some natural language.",
        "openLibraryQuery must be a compact field-aware Open Library query, not a full conversational sentence.",
        "Prefer subject:(...) and author:(...) style tokens when they help precision.",
        "Set popularityIntent to one of: none, popular, top-charts.",
        "Set recencyPreference to one of: none, modern, recent.",
        "For fresh recommendations, prefer recencyPreference=recent unless the user clearly asks for classics.",
        "excludeTerms should include things like poetry, collected works, anthology, reference if the user wants mainstream chart-like books.",
        "similarTo should capture referenced books or authors after phrases like 'like ...', plus authors echoed from the want list when relevant.",
        "genres/moods/seasonalContext must be arrays of lowercase strings.",
        `Club want-list authors: ${clubWantAuthors.join(", ") || "none"}`,
        `Club want-list genres/themes: ${clubWantGenres.join(", ") || "none"}`,
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
  const tone = inferDiscussionTone(input.clubVibe);
  const genres = normalizeList(input.genres);

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
        "You are a skilled book club moderator who creates engaging, thought-provoking discussions.",
        "Return only JSON with a single key named questions.",
        "questions must be an array of exactly 5 distinct questions.",
        "Generate 5 discussion questions for the following book.",
        "Questions should spark conversation and debate.",
        "Include a mix of character analysis, themes, emotional reactions, plot interpretation, and moral dilemmas when relevant.",
        "Encourage opinions, not factual recall.",
        "Avoid generic or obvious questions.",
        "Avoid yes/no questions.",
        "Keep each question under 2 lines.",
        "Make them feel natural and discussion-friendly.",
        "Do NOT summarize the book.",
        "Do NOT include answers.",
        `Adjust the tone of the questions to be ${tone}.`,
        `Title: ${input.title}`,
        `Description: ${input.description || "No description provided."}`,
        `Genres: ${genres.join(", ") || "unknown"}`,
        `Author: ${input.author || "Unknown author"}`,
        `Club: ${input.clubName || "Book club"}`,
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
    .map((value) => normalizeDiscussionQuestionText(value, ""))
    .filter(Boolean)
    .slice(0, 5);

  return questions.length === 5 ? questions : null;
}

function inferDiscussionTone(clubVibe?: string): "casual" | "deep" | "spicy" | "fun" {
  const vibe = clubVibe?.trim().toLowerCase() || "";

  if (!vibe) {
    return "deep";
  }

  if (/(chaotic|spicy|messy|dramatic|bold)/.test(vibe)) {
    return "spicy";
  }

  if (/(fun|playful|light|cozy|warm)/.test(vibe)) {
    return "fun";
  }

  if (/(casual|easygoing|relaxed|breezy)/.test(vibe)) {
    return "casual";
  }

  return "deep";
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
        "You are a witty literary critic.",
        "Given a reader's taste, write a short 1-3 line taste snapshot.",
        "Make it:",
        "- clever",
        "- slightly playful or insightful",
        "- not generic",
        "- not overly long",
        "- no emojis",
        "- vivid rather than vague",
        "Add constraints:",
        "- Avoid cliches like 'loves stories' or 'enjoys reading'",
        "- Keep under 40 words",
        "- Use at least one concrete signal from the provided taste data",
        "Return only JSON with keys: headline and summary.",
        "headline should be 2 to 4 words max.",
        "summary should be the snapshot only.",
        "Example:",
        "Reader taste: fantasy + political intrigue",
        "Output: Prefers kingdoms where power whispers louder than swords, and loyalty is always negotiable.",
        "Reader taste:",
        buildClubTasteContext(input),
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

  const parsed = JSON.parse(data.response) as { headline?: unknown; summary?: unknown };

  if (!parsed.headline || !parsed.summary) {
    return null;
  }

  return {
    headline: normalizeInsightText(parsed.headline, buildClubInsightHeadline(input)),
    summary: withPeriod(normalizeInsightText(parsed.summary, "The club insight is still warming up.")),
    source: "ollama",
  };
}

function buildFallbackClubTasteInsight(input: ClubTasteInsightRequest): ClubTasteInsight {
  const headline = input.topGenres.length > 0 ? `${input.topGenres[0]} with taste` : "Shelf with standards";
  const fallbackSummary = input.currentReadTitle
    ? `You keep drifting toward ${input.currentReadTitle}-style tension, with enough ${input.topGenres[0] || "bookish"} instinct to make the shelf feel deliberate rather than accidental.`
    : input.topGenres.length > 0
      ? `You keep reaching for ${input.topGenres.slice(0, 2).join(" and ")}, which gives the shelf a point of view and just enough menace to stay interesting.`
      : "Your shelf is still introducing itself, but it already reads like a group that prefers mood, sharp instincts, and a little dramatic tension.";
  return {
    headline,
    summary: withPeriod(fallbackSummary),
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

async function buildSearchPlan(prompt: string, context: BookSearchContext = {}): Promise<BookSearchPlan> {
  const normalizedPrompt = prompt.trim().toLowerCase();

  if (!normalizedPrompt) {
    return {
      intent: "broad-club-pick",
      rawPrompt: prompt,
      normalizedPrompt,
      query: "",
      openLibraryQuery: "",
      authorSeeds: [],
      titleSeeds: [],
      themeSeeds: [],
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
    const result = await parsePromptWithOllama(prompt, context);

    if (!result) {
      return buildFallbackPlan(prompt, context);
    }

    const baseAuthorSeeds = uniqueCaseInsensitive(normalizeList(result.authorSeeds).map((value) => String(value).trim()));
    const titleSeeds = uniqueCaseInsensitive(normalizeList(result.titleSeeds).map((value) => String(value).trim()));
    const baseSimilarTo = normalizeList(result.similarTo);
    const genres = normalizeList(result.genres);
    const moods = normalizeList(result.moods);
    const seasonalContext = normalizeList(result.seasonalContext).filter((value) => SEASON_TERMS.includes(value));
    const baseThemeSeeds = uniqueCaseInsensitive([
      ...normalizeList(result.themeSeeds).map((value) => String(value).trim()),
      ...genres.map((value) => String(value).trim()),
      ...moods.map((value) => String(value).trim()),
      ...seasonalContext.map((value) => String(value).trim()),
    ]);
    const inferredIntent = inferIntentFromPrompt(prompt, baseAuthorSeeds, titleSeeds, baseSimilarTo);
    const intent =
      result.intent && !(result.intent === "broad-club-pick" && inferredIntent !== "broad-club-pick")
        ? result.intent
        : inferredIntent;
    const retainsAuthorBias =
      intent === "author-expansion" || intent === "similar-book" || intent === "exact-book";
    const authorSeeds = retainsAuthorBias ? baseAuthorSeeds : [];
    const similarTo = retainsAuthorBias ? baseSimilarTo : [];
    const themeSeeds = retainsAuthorBias ? baseThemeSeeds : uniqueCaseInsensitive([...baseThemeSeeds, ...genres, ...moods]);
    const query = (result.query || prompt).trim();
    const recencyPreference = result.recencyPreference || "none";
    const popularityIntent = result.popularityIntent || "none";
    const openLibraryQuery = buildOpenLibraryQueryFromIntent({
      intent,
      query,
      openLibraryQuery: (result.openLibraryQuery || result.query || prompt).trim(),
      authorSeeds,
      titleSeeds,
      themeSeeds,
      recencyPreference,
      popularityIntent,
    });

    return {
      intent,
      rawPrompt: prompt,
      normalizedPrompt,
      query,
      openLibraryQuery,
      authorSeeds,
      titleSeeds,
      themeSeeds,
      genres,
      moods,
      seasonalContext,
      excludeTerms: normalizeList(result.excludeTerms),
      similarTo,
      popularityIntent,
      recencyPreference,
      explanation: result.explanation?.trim() || "Generated a search plan from the reader request.",
      source: "ollama",
    };
  } catch {
    return buildFallbackPlan(prompt, context);
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
  const authorTerms = plan.authorSeeds.map((value) => value.toLowerCase());
  const titleTerms = plan.titleSeeds.map((value) => value.toLowerCase());
  const themeTerms = plan.themeSeeds.map((value) => value.toLowerCase());
  const baseThemeTerms = getBaseThemeTerms(plan);
  const requiredThemeMatches = getRequiredThemeMatches(plan);
  const moodTerms = plan.moods;
  const seasonalTerms = plan.seasonalContext;
  const excludeTerms = [...plan.excludeTerms];
  const similarityExclusions = buildSimilarityExclusions(plan);
  const authorPopularityMap = new Map<string, number>();

  const getDocHaystack = (doc: OpenLibraryDoc) =>
    normalizeMatchText([doc.title ?? "", ...(doc.author_name ?? []), ...(doc.subject ?? [])].join(" "));

  const countDocGenreMatches = (doc: OpenLibraryDoc) => {
    const haystack = getDocHaystack(doc);

    return uniqueCaseInsensitive(plan.genres.map((genre) => normalizeMatchText(genre)).filter(Boolean)).reduce((count, genre) => {
      const aliases = uniqueCaseInsensitive(expandThemeAliases(genre));
      return count + (aliases.some((alias) => haystack.includes(normalizeMatchText(alias))) ? 1 : 0);
    }, 0);
  };

  const getDocPopularitySignal = (doc: OpenLibraryDoc) =>
    (doc.readinglog_count ?? 0) +
    (doc.want_to_read_count ?? 0) * 0.7 +
    (doc.already_read_count ?? 0) * 0.4 +
    (doc.ratings_count ?? 0) * 2 +
    (doc.edition_count ?? 0) * 6 +
    Math.max((doc.ratings_average ?? 0) - 3.5, 0) * 120;

  const getDocRecencyBoost = (doc: OpenLibraryDoc) => {
    const year = doc.first_publish_year;

    if (!year) {
      return 0;
    }

    if (year >= 2023) {
      return 9;
    }

    if (year >= 2020) {
      return 7;
    }

    if (year >= 2016) {
      return 4;
    }

    if (year >= 2010) {
      return 2;
    }

    return 0;
  };

  const getDocClassicBoost = (doc: OpenLibraryDoc) => {
    const year = doc.first_publish_year;
    const popularitySignal = getDocPopularitySignal(doc);

    if (!year) {
      return 0;
    }

    if (year <= 1950 && popularitySignal >= 400) {
      return 8;
    }

    if (year <= 1980 && popularitySignal >= 320) {
      return 6;
    }

    if (year <= 1995 && popularitySignal >= 250) {
      return 3;
    }

    return 0;
  };

  for (const doc of docs) {
    const normalizedAuthor = normalizeMatchText(doc.author_name?.[0] ?? "");
    if (!normalizedAuthor) {
      continue;
    }

    authorPopularityMap.set(normalizedAuthor, (authorPopularityMap.get(normalizedAuthor) ?? 0) + getDocPopularitySignal(doc));
  }

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

      const haystack = getDocHaystack(doc);
      const genreMatches = countDocGenreMatches(doc);
      const themeMatches = baseThemeTerms.reduce((count, theme) => {
        const aliases = uniqueCaseInsensitive(expandThemeAliases(theme));
        return count + (aliases.some((alias) => haystack.includes(normalizeMatchText(alias))) ? 1 : 0);
      }, 0);

      if (hasHardGenreConstraint(plan)) {
        return genreMatches >= getRequiredGenreMatches(plan);
      }

      if (plan.intent === "theme-discovery" && requiredThemeMatches >= 2) {
        return themeMatches >= requiredThemeMatches;
      }

      return genreTerms.some((genre) => subjects.some((subject) => subject.includes(genre)));
    })
    .sort((left, right) => {
      const scoreDoc = (doc: OpenLibraryDoc) => {
        const haystack = getDocHaystack(doc);
        let score = 0;
        const genreMatchCount = countDocGenreMatches(doc);
        const themeMatchCount = baseThemeTerms.reduce((count, theme) => {
          const aliases = uniqueCaseInsensitive(expandThemeAliases(theme));
          return count + (aliases.some((alias) => haystack.includes(normalizeMatchText(alias))) ? 1 : 0);
        }, 0);
        const authorPopularitySignal = authorPopularityMap.get(normalizeMatchText(doc.author_name?.[0] ?? "")) ?? 0;

        for (const genre of genreTerms) {
          if (haystack.includes(normalizeMatchText(genre))) {
            score += 5;
          }
        }

        score += genreMatchCount * 6;

        for (const theme of themeTerms) {
          if (haystack.includes(normalizeMatchText(theme))) {
            score += 4;
          }
        }

        score += themeMatchCount * 4;
        if (plan.intent === "theme-discovery") {
          if (hasHardGenreConstraint(plan) && genreMatchCount < getRequiredGenreMatches(plan)) {
            score -= 40;
          } else if (themeMatchCount >= requiredThemeMatches) {
            score += 18;
          } else {
            score -= requiredThemeMatches >= 2 ? 20 : 10;
          }
        }

        if (hasHardGenreConstraint(plan) && genreMatchCount < getRequiredGenreMatches(plan)) {
          score -= 18;
        }

        for (const authorSeed of authorTerms) {
          if ((doc.author_name ?? []).some((author) => author.toLowerCase().includes(authorSeed))) {
            score += 20;
          }
        }

        for (const titleSeed of titleTerms) {
          if ((doc.title ?? "").toLowerCase().includes(titleSeed)) {
            score += 24;
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

        score += Math.min(getDocPopularitySignal(doc) / 250, 10);
        score += getDocRecencyBoost(doc);
        score += getDocClassicBoost(doc);

        if (authorPopularitySignal >= 600) {
          score += 8;
        } else if (authorPopularitySignal >= 350) {
          score += 5;
        } else if (authorPopularitySignal >= 180) {
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
  return buildLocalQuery(plan);
}

function prefersSimilaritySeed(plan: BookSearchPlan): boolean {
  return plan.intent === "author-expansion" || plan.intent === "similar-book" || plan.similarTo.length > 0;
}

function buildOpenLibraryQuery(plan: BookSearchPlan): string {
  return buildOpenLibraryQueryFromIntent(plan);
}

function buildBookHaystack(book: Book): string {
  return normalizeMatchText(
    [book.title, book.author, book.genre, book.description, book.synopsis, ...(book.subjects ?? [])].join(" ")
  );
}

function buildBookGenreHaystack(book: Book): string {
  const primaryGenreSignals = [book.genre, ...(book.subjects ?? [])].map((value) => String(value || "").trim()).filter(Boolean);

  if (primaryGenreSignals.length > 0) {
    return normalizeMatchText(primaryGenreSignals.join(" "));
  }

  return normalizeMatchText([book.description, book.synopsis].join(" "));
}

function getBaseThemeTerms(plan: Pick<BookSearchPlan, "themeSeeds" | "genres">): string[] {
  return uniqueCaseInsensitive([...plan.themeSeeds, ...plan.genres].map((term) => normalizeMatchText(term)).filter(Boolean));
}

function expandThemeAliases(term: string): string[] {
  const normalized = normalizeMatchText(term);

  switch (normalized) {
    case "science fiction":
    case "sci fi":
    case "sci fi thriller":
      return ["science fiction", "sci fi", "sci-fi", "speculative fiction", "space opera"];
    case "thriller":
      return ["thriller", "suspense", "psychological thriller", "techno-thriller", "mystery thriller"];
    case "mystery":
      return ["mystery", "detective", "crime", "whodunit"];
    case "romance":
      return ["romance", "love story", "romantic"];
    case "fantasy":
      return ["fantasy", "epic fantasy", "magical realism"];
    default:
      return [normalized];
  }
}

function countMatchingTerms(haystack: string, terms: string[]): number {
  const normalizedTerms = uniqueCaseInsensitive(terms.map((term) => normalizeMatchText(term)).filter(Boolean));
  return normalizedTerms.reduce((count, term) => count + (haystack.includes(term) ? 1 : 0), 0);
}

function countAuthorSeedMatches(book: Book, plan: BookSearchPlan): number {
  return countMatchingTerms(normalizeMatchText(book.author), plan.authorSeeds);
}

function countTitleSeedMatches(book: Book, plan: BookSearchPlan): number {
  return countMatchingTerms(normalizeMatchText(book.title), plan.titleSeeds);
}

function countGenreMatches(book: Book, plan: Pick<BookSearchPlan, "genres">): number {
  const haystack = buildBookGenreHaystack(book);

  return uniqueCaseInsensitive(plan.genres.map((genre) => normalizeMatchText(genre)).filter(Boolean)).reduce((count, genre) => {
    const aliases = uniqueCaseInsensitive(expandThemeAliases(genre));
    return count + (aliases.some((alias) => haystack.includes(normalizeMatchText(alias))) ? 1 : 0);
  }, 0);
}

function countThemeMatches(book: Book, plan: BookSearchPlan): number {
  const haystack = buildBookHaystack(book);
  return getBaseThemeTerms(plan).reduce((count, theme) => {
    const aliases = uniqueCaseInsensitive(expandThemeAliases(theme));
    return count + (aliases.some((alias) => haystack.includes(normalizeMatchText(alias))) ? 1 : 0);
  }, 0);
}

function hasHardGenreConstraint(plan: Pick<BookSearchPlan, "intent" | "genres">): boolean {
  return plan.intent !== "exact-book" && plan.genres.length > 0;
}

function getRequiredGenreMatches(plan: Pick<BookSearchPlan, "genres">): number {
  return plan.genres.length;
}

function getRequiredThemeMatches(plan: Pick<BookSearchPlan, "themeSeeds" | "genres">): number {
  if (plan.genres.length > 0) {
    return getRequiredGenreMatches(plan);
  }

  const baseThemes = getBaseThemeTerms(plan);
  return baseThemes.length >= 2 ? 2 : baseThemes.length === 1 ? 1 : 0;
}

function getBookPopularitySignal(book: Book): number {
  return (
    Math.max(book.popularityScore, 0) +
    Math.max(book.ratingsCount ?? 0, 0) * 0.02 +
    Math.max((book.averageRating ?? 0) - 3.5, 0) * 60
  );
}

function getBookRecencyBoost(book: Book): number {
  const year = book.publishedAt?.getFullYear();

  if (!year) {
    return 0;
  }

  if (year >= 2023) {
    return 9;
  }

  if (year >= 2020) {
    return 7;
  }

  if (year >= 2016) {
    return 4;
  }

  if (year >= 2010) {
    return 2;
  }

  return 0;
}

function getBookClassicBoost(book: Book): number {
  const year = book.publishedAt?.getFullYear();
  const popularitySignal = getBookPopularitySignal(book);

  if (!year) {
    return 0;
  }

  if (year <= 1950 && popularitySignal >= 120) {
    return 8;
  }

  if (year <= 1980 && popularitySignal >= 100) {
    return 6;
  }

  if (year <= 1995 && popularitySignal >= 90) {
    return 3;
  }

  return 0;
}

function hasStrongLocalIntentMatch(plan: BookSearchPlan, rankedBooks: Book[]): boolean {
  const candidates = rankedBooks.slice(0, Math.min(3, rankedBooks.length));

  if (candidates.length === 0) {
    return false;
  }

  switch (plan.intent) {
    case "author-expansion":
      return candidates.some((book) => countAuthorSeedMatches(book, plan) > 0);
    case "exact-book":
      return candidates.some((book) => countTitleSeedMatches(book, plan) > 0);
    case "similar-book":
      return candidates.some(
        (book) =>
          countTitleSeedMatches(book, plan) > 0 ||
          countAuthorSeedMatches(book, plan) > 0 ||
          countThemeMatches(book, plan) > 0
      );
    case "theme-discovery": {
      const requiredMatches = getRequiredThemeMatches(plan);
      return candidates.some((book) => {
        if (hasHardGenreConstraint(plan) && countGenreMatches(book, plan) < getRequiredGenreMatches(plan)) {
          return false;
        }

        return countThemeMatches(book, plan) >= requiredMatches;
      });
    }
    case "broad-club-pick":
    default:
      return candidates.length > 0;
  }
}

function selectIntentAlignedBooks(rankedBooks: Book[], plan: BookSearchPlan, limit: number): Book[] {
  switch (plan.intent) {
    case "author-expansion": {
      const genreConstrainedBooks = hasHardGenreConstraint(plan)
        ? rankedBooks.filter((book) => countGenreMatches(book, plan) >= getRequiredGenreMatches(plan))
        : rankedBooks;
      const authorMatches = genreConstrainedBooks.filter(
        (book) =>
          countAuthorSeedMatches(book, plan) > 0
      );
      return (authorMatches.length > 0 ? authorMatches : genreConstrainedBooks).slice(0, limit);
    }
    case "exact-book": {
      const titleMatches = rankedBooks.filter((book) => countTitleSeedMatches(book, plan) > 0);
      return (titleMatches.length > 0 ? titleMatches : rankedBooks).slice(0, limit);
    }
    case "similar-book": {
      const genreConstrainedBooks = hasHardGenreConstraint(plan)
        ? rankedBooks.filter((book) => countGenreMatches(book, plan) >= getRequiredGenreMatches(plan))
        : rankedBooks;
      const similarMatches = genreConstrainedBooks.filter(
        (book) =>
          (
          countTitleSeedMatches(book, plan) > 0 ||
          countAuthorSeedMatches(book, plan) > 0 ||
          countThemeMatches(book, plan) > 0
          )
      );
      return (similarMatches.length > 0 ? similarMatches : genreConstrainedBooks).slice(0, limit);
    }
    case "theme-discovery": {
      const genreConstrainedBooks = hasHardGenreConstraint(plan)
        ? rankedBooks.filter((book) => countGenreMatches(book, plan) >= getRequiredGenreMatches(plan))
        : rankedBooks;
      const requiredMatches = getRequiredThemeMatches(plan);
      const strictThemeMatches = genreConstrainedBooks.filter((book) => countThemeMatches(book, plan) >= requiredMatches);
      if (strictThemeMatches.length > 0) {
        return strictThemeMatches.slice(0, limit);
      }

      if (hasHardGenreConstraint(plan)) {
        return genreConstrainedBooks.slice(0, limit);
      }

      if (requiredMatches >= 2) {
        return [];
      }

      const relaxedThemeMatches = genreConstrainedBooks.filter((book) => countThemeMatches(book, plan) > 0);
      return (relaxedThemeMatches.length > 0 ? relaxedThemeMatches : rankedBooks).slice(0, limit);
    }
    case "broad-club-pick":
    default:
      return rankedBooks.slice(0, limit);
  }
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
  const authorTerms = plan.authorSeeds.map((value) => value.toLowerCase());
  const titleTerms = plan.titleSeeds.map((value) => value.toLowerCase());
  const themeTerms = plan.themeSeeds.map((value) => value.toLowerCase());
  const authorPopularityMap = new Map<string, number>();

  for (const book of books) {
    const normalizedAuthor = normalizeMatchText(book.author);
    if (!normalizedAuthor) {
      continue;
    }

    authorPopularityMap.set(normalizedAuthor, (authorPopularityMap.get(normalizedAuthor) ?? 0) + getBookPopularitySignal(book));
  }

  const scoreBook = (book: Book) => {
    if (looksLikeSimilaritySeed(book.title, similarityExclusions)) {
      return Number.NEGATIVE_INFINITY;
    }

    const haystack = buildBookHaystack(book);
    let score = 0;
    const authorMatchCount = countAuthorSeedMatches(book, plan);
    const titleMatchCount = countTitleSeedMatches(book, plan);
    const genreMatchCount = countGenreMatches(book, plan);
    const themeMatchCount = countThemeMatches(book, plan);
    const authorPopularitySignal = authorPopularityMap.get(normalizeMatchText(book.author)) ?? 0;

    for (const genre of plan.genres) {
      if (haystack.includes(normalizeMatchText(genre))) {
        score += 4;
      }
    }

    score += genreMatchCount * 5;

    for (const theme of themeTerms) {
      if (haystack.includes(normalizeMatchText(theme))) {
        score += 4;
      }
    }

    score += authorMatchCount * 20;

    score += titleMatchCount * 24;
    score += themeMatchCount * 3;

    if (plan.intent === "theme-discovery") {
      const requiredThemeMatches = getRequiredThemeMatches(plan);
      if (hasHardGenreConstraint(plan) && genreMatchCount < getRequiredGenreMatches(plan)) {
        score -= 40;
      } else if (themeMatchCount >= requiredThemeMatches) {
        score += 16;
      } else {
        score -= requiredThemeMatches === 2 ? 18 : 10;
      }
    }

    if (hasHardGenreConstraint(plan) && genreMatchCount < getRequiredGenreMatches(plan)) {
      score -= 18;
    }

    if (plan.intent === "author-expansion" && authorMatchCount === 0) {
      score -= 25;
    }

    if (plan.intent === "exact-book" && titleMatchCount === 0) {
      score -= 30;
    }

    for (const mood of plan.moods) {
      if (haystack.includes(normalizeMatchText(mood))) {
        score += 2;
      }
    }

    for (const season of plan.seasonalContext) {
      if (haystack.includes(normalizeMatchText(season))) {
        score += 2;
      }
    }

    for (const token of cleanQueryTerms(plan.query)) {
      if (haystack.includes(normalizeMatchText(token))) {
        score += 1;
      }
    }

    score += Math.min(getBookPopularitySignal(book) / 40, 10);
    score += getBookRecencyBoost(book);
    score += getBookClassicBoost(book);

    if (authorPopularitySignal >= 220) {
      score += 8;
    } else if (authorPopularitySignal >= 140) {
      score += 5;
    } else if (authorPopularitySignal >= 80) {
      score += 2;
    }

    return score;
  };

  return [...books]
    .filter((book) => !looksLikeSimilaritySeed(book.title, similarityExclusions))
    .sort((a, b) => scoreBook(b) - scoreBook(a));
}

function dedupeBookEntities(books: Book[]): Book[] {
  return dedupeBooksByCompleteness(
    books.filter((book): book is Book => Boolean(book?.id))
  );
}

function hasWeakLocalCoverage(plan: BookSearchPlan, localBooks: Book[], limit: number): boolean {
  if (localBooks.length === 0) {
    return true;
  }

  if (!hasStrongLocalIntentMatch(plan, localBooks)) {
    return true;
  }

  if ((plan.intent === "author-expansion" || plan.intent === "exact-book") && localBooks.length < Math.min(limit, 3)) {
    return true;
  }

  return localBooks.length < Math.max(3, Math.ceil(limit / 2));
}

async function retrieveLocalCandidates(
  plan: BookSearchPlan,
  prompt: string,
  limit: number,
  queryEmbedding: { embedding: number[]; model: string } | null
): Promise<Book[]> {
  const localQuery = buildRepositoryQuery(plan) || prompt.trim() || undefined;
  const localGenres = prefersSimilaritySeed(plan) ? undefined : plan.genres;
  const candidateLimit = Math.max(limit * 8, 40);

  const [titleCandidates, authorCandidates, ftsCandidates, semanticCandidates] = await Promise.all([
    listBooksByTitleSeeds(plan.titleSeeds, candidateLimit),
    listBooksByAuthorSeeds([...plan.authorSeeds, ...plan.similarTo], candidateLimit),
    listBooks({
      query: localQuery,
      genres: localGenres,
      limit: candidateLimit,
    }),
    queryEmbedding?.embedding
      ? listBooks({
          query: localQuery,
          genres: localGenres,
          embedding: queryEmbedding.embedding,
          limit: candidateLimit,
        })
      : Promise.resolve([]),
  ]);

  return dedupeBookEntities([
    ...titleCandidates,
    ...authorCandidates,
    ...ftsCandidates,
    ...semanticCandidates,
  ]);
}

export async function recommendBooksFromPrompt(
  prompt: string,
  limit = 8,
  options: { mode?: "fast" | "full"; excludeBookIds?: string[]; explicitPrompt?: boolean } = {}
): Promise<RecommendationResponse> {
  const mode = options.mode ?? "fast";
  const explicitPrompt = options.explicitPrompt ?? Boolean(prompt.trim());
  const excludedBookIds = new Set((options.excludeBookIds ?? []).map((id) => String(id).trim()).filter(Boolean));
  const removeExcludedBooks = <T extends { id: string }>(books: T[]) =>
    books.filter((book) => !excludedBookIds.has(String(book.id).trim()));
  const fastSearchPlan = buildFallbackPlan(prompt);
  const structuredSearchPlanPromise = explicitPrompt ? buildSearchPlan(prompt) : Promise.resolve(fastSearchPlan);
  const embeddingPromise = embedTextWithOllama(prompt).catch(() => null);
  const fastLocalCandidates = await retrieveLocalCandidates(fastSearchPlan, prompt, limit, null);
  const rankedFastLocalBooks = selectIntentAlignedBooks(
    removeExcludedBooks(rankBooks(fastLocalCandidates, fastSearchPlan)),
    fastSearchPlan,
    limit
  );

  if (mode === "fast" && hasStrongLocalIntentMatch(fastSearchPlan, rankedFastLocalBooks)) {
    return {
      searchPlan: {
        ...fastSearchPlan,
        explanation: "Used the local catalog for an immediate recommendation pass.",
      },
      books: rankedFastLocalBooks,
    };
  }

  const searchPlan = await structuredSearchPlanPromise;
  const queryEmbedding = await embeddingPromise;
  const fullLocalCandidates = await retrieveLocalCandidates(searchPlan, prompt, limit, queryEmbedding);
  const rankedLocalBooks = selectIntentAlignedBooks(
    removeExcludedBooks(rankBooks(fullLocalCandidates, searchPlan)),
    searchPlan,
    limit
  );

  if (mode === "fast" && hasStrongLocalIntentMatch(searchPlan, rankedLocalBooks)) {
    return {
      searchPlan: {
        ...searchPlan,
        explanation: "Used the local catalog with semantic retrieval for a fast recommendation pass.",
      },
      books: rankedLocalBooks,
    };
  }

  if (!hasWeakLocalCoverage(searchPlan, rankedLocalBooks, limit)) {
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
      await fetchOpenLibraryBooks(searchPlan, Math.max(limit * 2, 10))
    );
    const mergedBooks = rankBooks(
      dedupeBookEntities([...rankedLocalBooks, ...removeExcludedBooks(openLibraryBooks)]),
      searchPlan
    );

    return {
      searchPlan: {
        ...searchPlan,
        explanation: `${searchPlan.explanation} Local results were topped up with Open Library candidates where coverage was thin.`,
      },
      books: selectIntentAlignedBooks(mergedBooks, searchPlan, limit),
    };
  } catch {
    return {
      searchPlan,
      books: rankedLocalBooks,
    };
  }
}

export const __testables = {
  buildFallbackPlan,
  rankBooks,
  hasStrongLocalIntentMatch,
  selectIntentAlignedBooks,
};
