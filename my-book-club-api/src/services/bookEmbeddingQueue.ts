import type { Book } from "../domain/entities/Book.js";
import { updateBookEmbedding } from "../repositories/books.js";
import { buildBookEmbeddingText, embedTextWithOllama } from "./embeddings.js";

const queuedBooks = new Map<string, Book>();
let drainPromise: Promise<void> | null = null;

async function embedBook(book: Book): Promise<void> {
  if ((book.embedding && book.embedding.length > 0) || book.embeddingModel) {
    return;
  }

  const embeddingResult = await embedTextWithOllama(
    buildBookEmbeddingText({
      title: book.title,
      author: book.author,
      genre: book.genre,
      description: book.description,
      synopsis: book.synopsis,
      subjects: book.subjects,
    })
  ).catch(() => null);

  if (!embeddingResult) {
    return;
  }

  await updateBookEmbedding(book.id, embeddingResult.embedding, embeddingResult.model).catch(() => undefined);
}

async function drainQueue(): Promise<void> {
  while (queuedBooks.size > 0) {
    const nextEntry = queuedBooks.entries().next().value as [string, Book] | undefined;

    if (!nextEntry) {
      return;
    }

    const [bookId, book] = nextEntry;
    queuedBooks.delete(bookId);
    await embedBook(book);
  }
}

export function queueBooksForBackgroundEmbedding(books: Book[]): void {
  for (const book of books) {
    if (!book?.id) {
      continue;
    }

    if ((book.embedding && book.embedding.length > 0) || book.embeddingModel) {
      continue;
    }

    queuedBooks.set(book.id, book);
  }

  if (!drainPromise) {
    drainPromise = drainQueue().finally(() => {
      drainPromise = null;

      if (queuedBooks.size > 0) {
        queueMicrotask(() => {
          if (!drainPromise) {
            drainPromise = drainQueue().finally(() => {
              drainPromise = null;
            });
          }
        });
      }
    });
  }
}
