import { getRedisClient } from "../config/redis.js";

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();

  if (!client) {
    return null;
  }

  try {
    const raw = await client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setCachedJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = await getRedisClient();

  if (!client) {
    return;
  }

  try {
    await client.set(key, JSON.stringify(value), {
      EX: ttlSeconds,
    });
  } catch {
    // Best-effort cache write.
  }
}

export async function deleteCached(key: string): Promise<void> {
  const client = await getRedisClient();

  if (!client) {
    return;
  }

  try {
    await client.del(key);
  } catch {
    // Best-effort cache delete.
  }
}
