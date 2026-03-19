const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_EMBED_MODEL = "mxbai-embed-large";
const EMBEDDING_CACHE_TTL_MS = 10 * 60 * 1000;
const embeddingCache = new Map<string, { expiresAt: number; value: { embedding: number[]; model: string } | null }>();
const pendingEmbeddings = new Map<string, Promise<{ embedding: number[]; model: string } | null>>();

export function buildBookEmbeddingText(input: {
  title: string;
  author?: string;
  genre?: string;
  description?: string;
  synopsis?: string;
  subjects?: string[];
}): string {
  return [
    input.title,
    input.author || "",
    input.genre || "",
    input.description || "",
    input.synopsis || "",
    ...(input.subjects ?? []),
  ]
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(". ");
}

export async function embedTextWithOllama(text: string): Promise<{ embedding: number[]; model: string } | null> {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL;
  const model = process.env.OLLAMA_EMBED_MODEL?.trim() || DEFAULT_OLLAMA_EMBED_MODEL;
  const normalizedText = text.trim();

  if (!normalizedText) {
    return null;
  }

  const cacheKey = `${baseUrl}::${model}::${normalizedText.toLowerCase()}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pending = pendingEmbeddings.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = fetch(`${baseUrl}/api/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: normalizedText,
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Ollama embeddings returned ${response.status}`);
      }

      const data = (await response.json()) as { embedding?: number[] };

      if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
        embeddingCache.set(cacheKey, {
          expiresAt: Date.now() + EMBEDDING_CACHE_TTL_MS,
          value: null,
        });
        return null;
      }

      const value = {
        embedding: data.embedding.map(Number).filter((entry) => Number.isFinite(entry)),
        model,
      };
      embeddingCache.set(cacheKey, {
        expiresAt: Date.now() + EMBEDDING_CACHE_TTL_MS,
        value,
      });
      return value;
    })
    .finally(() => {
      pendingEmbeddings.delete(cacheKey);
    });

  pendingEmbeddings.set(cacheKey, request);
  return request;
}
