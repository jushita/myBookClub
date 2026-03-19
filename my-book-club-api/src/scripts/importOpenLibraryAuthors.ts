import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import "../config/env.js";
import { updatePrimaryAuthorByAuthorKey } from "../repositories/books.js";

type OpenLibraryAuthor = {
  key?: string;
  name?: string;
  personal_name?: string;
};

function getArg(name: string): string | undefined {
  const index = process.argv.findIndex((value) => value === `--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const file = getArg("file");
  const limit = Number(getArg("limit") || "0");

  if (!file) {
    throw new Error("Missing --file argument. Example: npm run db:import:authors -- --file /path/to/ol_dump_authors_latest.txt.gz --limit 5000");
  }

  const resolvedFile = path.resolve(file);
  const input = fs.createReadStream(resolvedFile).pipe(zlib.createGunzip());
  const reader = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  let scanned = 0;
  let matched = 0;
  let updatedRows = 0;

  for await (const line of reader) {
    scanned += 1;
    const columns = line.split("\t");
    const payload = columns[4];

    if (!payload) {
      continue;
    }

    let author: OpenLibraryAuthor;
    try {
      author = JSON.parse(payload) as OpenLibraryAuthor;
    } catch {
      continue;
    }

    const authorKey = String(author.key || "").trim();
    const authorName = String(author.name || author.personal_name || "").trim();

    if (!authorKey || !authorName) {
      continue;
    }

    const updated = await updatePrimaryAuthorByAuthorKey(authorKey, authorName);

    if (updated > 0) {
      matched += 1;
      updatedRows += updated;
    }

    if (scanned % 1000 === 0) {
      console.log(`Scanned ${scanned} authors, matched ${matched}, updated ${updatedRows} book rows`);
    }

    if (limit > 0 && scanned >= limit) {
      break;
    }
  }

  console.log(`Done. Scanned ${scanned} authors, matched ${matched}, updated ${updatedRows} book rows.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
