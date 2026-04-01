import { createClient } from "redis";

let redisClientPromise: Promise<ReturnType<typeof createClient> | null> | null = null;

export async function getRedisClient() {
  if (redisClientPromise) {
    return redisClientPromise;
  }

  redisClientPromise = (async () => {
    const redisUrl = process.env.REDIS_URL?.trim();

    if (!redisUrl) {
      return null;
    }

    const client = createClient({
      url: redisUrl,
    });

    client.on("error", (error) => {
      console.error("Redis client error", error);
    });

    await client.connect();
    return client;
  })().catch((error) => {
    console.error("Redis connection failed", error);
    redisClientPromise = null;
    return null;
  });

  return redisClientPromise;
}
