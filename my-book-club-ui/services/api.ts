import { Platform } from "react-native";
import type { Book } from "../types";

const defaultBaseUrl =
  Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || defaultBaseUrl;

type ApiBook = {
  id: string;
  title: string;
  author: string;
  genre: string;
  description?: string;
};

function toBook(apiBook: ApiBook): Book {
  return {
    id: apiBook.id,
    title: apiBook.title,
    author: apiBook.author,
    genre: apiBook.genre,
    note: apiBook.description || "Saved from the club API.",
  };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchBooks(): Promise<Book[]> {
  const data = await requestJson<{ books: ApiBook[] }>("/api/books");
  return data.books.map(toBook);
}

export async function createBook(input: {
  title: string;
  author: string;
  genre: string;
  description: string;
}): Promise<Book> {
  const data = await requestJson<{ book: ApiBook }>("/api/books", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return toBook(data.book);
}
