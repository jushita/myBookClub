export function cleanBookText(value?: string | null): string {
  return value?.trim() || "";
}

export function isGenericFallbackBlurb(value: string): boolean {
  const text = cleanBookText(value).toLowerCase();
  if (!text) {
    return false;
  }

  return (
    /^a .* pick by .+\.$/.test(text) ||
    /^a .* pick by .+ first published in \d{4}\.$/.test(text) ||
    /^a book by .+\.$/.test(text) ||
    /^found through google books\.$/.test(text)
  );
}

export function normalizeGenreLabel(value?: string | null): string {
  const raw = cleanBookText(value);
  if (!raw) {
    return "";
  }

  const primary =
    raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)[0] || "";

  if (!primary || primary.length > 32) {
    return "";
  }

  return primary;
}

export function pickDisplaySummary(input: {
  synopsis?: string | null;
  description?: string | null;
  fallback?: string | null;
}): { note: string; description: string; synopsis: string } {
  const synopsis = cleanBookText(input.synopsis);
  const description = cleanBookText(input.description);
  const fallback = cleanBookText(input.fallback);
  const preferred = synopsis || description || fallback;
  const safeSummary = isGenericFallbackBlurb(preferred) ? "" : preferred;

  return {
    note: safeSummary,
    description: safeSummary,
    synopsis: safeSummary,
  };
}
