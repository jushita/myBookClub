import type { Book } from "../types";
import { apiBaseUrl, requestJson } from "./http";

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

export async function fetchBooks(): Promise<Book[]> {
  const data = await requestJson<{ books: ApiBook[] }>(`${apiBaseUrl}/api/books`);
  return data.books.map(toBook);
}

export async function createBook(input: {
  title: string;
  author: string;
  genre: string;
  description: string;
}): Promise<Book> {
  const data = await requestJson<{ book: ApiBook }>(`${apiBaseUrl}/api/books`, {
    method: "POST",
    body: JSON.stringify(input),
  });

  return toBook(data.book);
}
