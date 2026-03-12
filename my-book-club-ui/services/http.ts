import { Platform } from "react-native";

const defaultBaseUrl =
  Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || defaultBaseUrl;

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) {
        message = data.error;
      }
    } catch {
      // ignore malformed error bodies
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
