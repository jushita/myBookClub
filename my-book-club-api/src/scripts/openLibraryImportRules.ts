type CommonImportFields = {
  title?: string;
  description?: string;
  subjects?: string[];
  publishers?: string[];
  language?: string | null;
  coverImageUrl?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  pageCount?: number | null;
  authorName?: string | null;
};

type Tier = "tierA" | "tierB" | "reject";
type ClassificationReason =
  | "not_meaningful_title"
  | "title_too_long"
  | "not_english"
  | "missing_real_author"
  | "low_metadata"
  | "not_reader_book"
  | "high_institutional_risk";

type ClassificationResult = {
  tier: Tier;
  reasons: ClassificationReason[];
  scores: {
    metadataSignals: number;
    metadataQuality: number;
    reader: number;
    institutionalRisk: number;
    final: number;
  };
};

const TITLE_RISK_WEIGHTS = new Map<string, number>([
  ["bill", 1],
  ["act", 1],
  ["parliament", 1],
  ["regulation", 1],
  ["report", 1],
  ["hearing", 1],
  ["statute", 1],
  ["legal", 1],
  ["law", 1],
  ["court", 1],
  ["government", 1],
  ["proceedings", 1],
  ["catalog", 1],
  ["directory", 1],
  ["manual", 1],
  ["handbook", 1],
  ["standards", 1],
  ["specification", 1],
  ["committee", 1],
  ["department", 1],
  ["industrial", 1],
  ["bibliography", 1],
  ["inventory", 1],
  ["register", 1],
  ["code of federal regulations", 2],
  ["annual report", 2],
]);

const SUBJECT_RISK_WEIGHTS = new Map<string, number>([
  ["law", 3],
  ["legal", 3],
  ["government", 3],
  ["public policy", 3],
  ["legislation", 3],
  ["court", 3],
  ["regulations", 3],
  ["conference", 2],
  ["proceedings", 2],
  ["standards", 2],
  ["specifications", 2],
  ["statistics", 2],
  ["committee", 2],
  ["hearings", 2],
  ["industrial management", 2],
  ["reference", 2],
  ["directories", 2],
  ["bibliography", 2],
  ["catalogs", 2],
]);

const PUBLISHER_RISK_WEIGHTS = new Map<string, number>([
  ["department", 2],
  ["ministry", 2],
  ["committee", 2],
  ["commission", 2],
  ["office", 2],
  ["government", 2],
  ["parliament", 2],
  ["congress", 2],
  ["senate", 2],
  ["house of representatives", 2],
  ["stationery office", 3],
  ["national statistics", 2],
  ["regulatory", 2],
]);

const READER_SIGNAL_WEIGHTS = new Map<string, number>([
  ["fiction", 2],
  ["novel", 2],
  ["mystery", 2],
  ["romance", 2],
  ["fantasy", 2],
  ["horror", 2],
  ["thriller", 2],
  ["young adult", 2],
  ["science fiction", 2],
  ["historical fiction", 2],
  ["memoir", 1],
  ["biography", 1],
  ["literature", 1],
  ["poetry", 1],
  ["essays", 1],
  ["drama", 1],
  ["graphic novels", 2],
  ["comics", 2],
  ["children", 1],
  ["psychological fiction", 2],
  ["suspense fiction", 2],
  ["gothic fiction", 2],
]);

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function meaningfulTitle(title: string): boolean {
  const normalized = normalize(title);
  return normalized.length >= 2 && !/^[0-9\W_]+$/.test(normalized);
}

function hasRealAuthor(authorName?: string | null): boolean {
  return Boolean(authorName && authorName !== "Unknown author" && !authorName.startsWith("/authors/"));
}

function buildHaystacks(input: CommonImportFields) {
  const title = normalize(String(input.title || ""));
  const subjects = (input.subjects ?? []).map(normalize);
  const publishers = (input.publishers ?? []).map(normalize);

  return {
    titleHaystack: title,
    subjectHaystack: subjects.join(" "),
    publisherHaystack: publishers.join(" "),
    combinedHaystack: `${title} ${subjects.join(" ")} ${publishers.join(" ")}`.trim(),
  };
}

function scoreMapMatches(haystack: string, weights: Map<string, number>): number {
  let score = 0;

  for (const [term, weight] of weights) {
    if (haystack.includes(term)) {
      score += weight;
    }
  }

  return score;
}

function metadataSignalCount(input: CommonImportFields): number {
  let score = 0;

  if (input.isbn10 || input.isbn13) {
    score += 1;
  }

  if (input.coverImageUrl) {
    score += 1;
  }

  if (input.description && input.description.trim().length >= 40) {
    score += 1;
  }

  if ((input.subjects ?? []).filter(Boolean).length >= 3) {
    score += 1;
  }

  if ((input.pageCount ?? 0) >= 20) {
    score += 1;
  }

  if (hasRealAuthor(input.authorName)) {
    score += 1;
  }

  return score;
}

function metadataQualityScore(input: CommonImportFields): number {
  let score = metadataSignalCount(input);

  if (input.description && input.description.trim().length >= 120) {
    score += 1;
  }

  if (input.coverImageUrl) {
    score += 1;
  }

  if ((input.pageCount ?? 0) >= 120) {
    score += 1;
  }

  return score;
}

function readerScore(input: CommonImportFields): number {
  const { combinedHaystack } = buildHaystacks(input);
  return scoreMapMatches(combinedHaystack, READER_SIGNAL_WEIGHTS);
}

function institutionalRiskScore(input: CommonImportFields): number {
  const { titleHaystack, subjectHaystack, publisherHaystack } = buildHaystacks(input);
  let score = 0;

  score += scoreMapMatches(titleHaystack, TITLE_RISK_WEIGHTS);
  score += scoreMapMatches(subjectHaystack, SUBJECT_RISK_WEIGHTS);
  score += scoreMapMatches(publisherHaystack, PUBLISHER_RISK_WEIGHTS);

  if (!hasRealAuthor(input.authorName)) {
    score += 2;
  }

  if ((input.pageCount ?? 0) > 0 && (input.pageCount ?? 0) < 40) {
    score += 1;
  }

  if (metadataSignalCount(input) <= 1) {
    score += 2;
  }

  return score;
}

export function looksImportable(input: CommonImportFields): boolean {
  const title = String(input.title || "").trim();

  if (!title || !meaningfulTitle(title)) {
    return false;
  }

  return title.length <= 240;
}

function getImportabilityReasons(input: CommonImportFields): ClassificationReason[] {
  const title = String(input.title || "").trim();

  if (!title || !meaningfulTitle(title)) {
    return ["not_meaningful_title"];
  }

  if (title.length > 240) {
    return ["title_too_long"];
  }

  return [];
}

export function minimumMetadataThreshold(input: CommonImportFields): boolean {
  return hasRealAuthor(input.authorName) && metadataSignalCount(input) >= 2;
}

export function englishFirst(language?: string | null): boolean {
  if (!language) {
    return false;
  }

  const normalized = normalize(language);
  return normalized === "/languages/eng" || normalized === "eng" || normalized.includes("english");
}

export function isReaderBook(input: CommonImportFields): boolean {
  return (readerScore(input) > 0 || metadataSignalCount(input) >= 2) && institutionalRiskScore(input) < 5;
}

export function qualityScore(input: CommonImportFields): number {
  return metadataQualityScore(input) + readerScore(input) - institutionalRiskScore(input);
}

export function explainImportClassification(input: CommonImportFields): ClassificationResult {
  const reasons = getImportabilityReasons(input);
  const metadataSignals = metadataSignalCount(input);
  const metadataQuality = metadataQualityScore(input);
  const reader = readerScore(input);
  const institutionalRisk = institutionalRiskScore(input);
  const final = metadataQuality + reader - institutionalRisk;

  if (reasons.length > 0) {
    return {
      tier: "reject",
      reasons,
      scores: { metadataSignals, metadataQuality, reader, institutionalRisk, final },
    };
  }

  if (!englishFirst(input.language)) {
    return {
      tier: "reject",
      reasons: ["not_english"],
      scores: { metadataSignals, metadataQuality, reader, institutionalRisk, final },
    };
  }

  if (!hasRealAuthor(input.authorName)) {
    return {
      tier: "reject",
      reasons: ["missing_real_author"],
      scores: { metadataSignals, metadataQuality, reader, institutionalRisk, final },
    };
  }

  if (metadataSignals < 2) {
    return {
      tier: "reject",
      reasons: ["low_metadata"],
      scores: { metadataSignals, metadataQuality, reader, institutionalRisk, final },
    };
  }

  if (!isReaderBook(input)) {
    return {
      tier: "reject",
      reasons: ["not_reader_book"],
      scores: { metadataSignals, metadataQuality, reader, institutionalRisk, final },
    };
  }

  if (institutionalRisk >= 6) {
    return {
      tier: "reject",
      reasons: ["high_institutional_risk"],
      scores: { metadataSignals, metadataQuality, reader, institutionalRisk, final },
    };
  }

  return {
    tier: final >= 5 ? "tierA" : "tierB",
    reasons: [],
    scores: { metadataSignals, metadataQuality, reader, institutionalRisk, final },
  };
}

export function classifyImportTier(input: CommonImportFields): Tier {
  return explainImportClassification(input).tier;
}
