import "../config/env.js";
import { listBooksWithoutEmbeddings, updateBookEmbedding } from "../repositories/books.js";
import { buildBookEmbeddingText, embedTextWithOllama } from "../services/embeddings.js";

function getArg(name: string): string | undefined {
  const index = process.argv.findIndex((value) => value === `--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const requestedLimit = getArg("limit");
  const limit = requestedLimit ? Math.max(1, Number(requestedLimit)) : 2000;
  const books = await listBooksWithoutEmbeddings(limit);
  let embedded = 0;

  for (const book of books) {
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
      continue;
    }

    await updateBookEmbedding(book.id, embeddingResult.embedding, embeddingResult.model);
    embedded += 1;
    console.log(`Embedded ${embedded}: ${book.title}`);
  }

  console.log(`Done. Embedded ${embedded} books.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
