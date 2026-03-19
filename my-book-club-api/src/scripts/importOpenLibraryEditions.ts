import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import "../config/env.js";
import { findBookByIsbn, findBookByWorkKey, upsertBook } from "../repositories/books.js";
import { Book } from "../domain/entities/Book.js";
import { explainImportClassification } from "./openLibraryImportRules.js";

type OpenLibraryEdition = {
  key?: string;
  title?: string;
  subtitle?: string;
  publish_date?: string;
  number_of_pages?: number;
  publishers?: string[];
  isbn_10?: string[];
  isbn_13?: string[];
  covers?: number[];
  subjects?: string[];
  works?: Array<{ key?: string }>;
  authors?: Array<{ key?: string }>;
  languages?: Array<{ key?: string }>;
};

type SampleRow = {
  title: string;
  author: string;
  reasons: string[];
};

function getArg(name: string): string | undefined {
  const index = process.argv.findIndex((value) => value === `--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parsePublishedAt(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const yearMatch = value.match(/\d{4}/);
  return yearMatch ? new Date(`${yearMatch[0]}-01-01T00:00:00.000Z`) : null;
}

function buildCoverUrl(covers: number[] | undefined): string | null {
  const coverId = covers?.[0];
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
}

async function main() {
  const file = getArg("file");
  const limit = Number(getArg("limit") || "0");
  const scanLimit = Number(getArg("scan-limit") || "0");
  const dryRun = process.argv.includes("--dry-run");
  const preview = process.argv.includes("--preview");
  const previewLimit = Number(getArg("preview-limit") || "5");

  if (!file) {
    throw new Error("Missing --file argument. Example: npm run db:import:editions -- --file /path/to/ol_dump_editions_latest.txt.gz --limit 5000");
  }

  const resolvedFile = path.resolve(file);
  const input = fs.createReadStream(resolvedFile).pipe(zlib.createGunzip());
  const reader = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  let imported = 0;
  let scanned = 0;
  let tierAImported = 0;
  let tierBImported = 0;
  let rejected = 0;
  const rejectionReasons = new Map<string, number>();
  const tierASamples: SampleRow[] = [];
  const tierBSamples: SampleRow[] = [];
  const rejectedSamples: SampleRow[] = [];

  for await (const line of reader) {
    scanned += 1;
    const columns = line.split("\t");
    const payload = columns[4];

    if (!payload) {
      continue;
    }

    let edition: OpenLibraryEdition;
    try {
      edition = JSON.parse(payload) as OpenLibraryEdition;
    } catch {
      continue;
    }

    const primaryWorkKey = edition.works?.[0]?.key;
    const authorKeys = (edition.authors ?? [])
      .map((author) => author.key)
      .filter((value): value is string => Boolean(value))
      .slice(0, 5);
    const subjects = (edition.subjects ?? []).map((value) => String(value).trim()).filter(Boolean).slice(0, 20);
    const canonicalId = primaryWorkKey || edition.key;
    const isbn10 = edition.isbn_10?.[0] ?? null;
    const isbn13 = edition.isbn_13?.[0] ?? null;
    const baseTitle = String(edition.title || "").trim();
    const title = edition.subtitle ? `${baseTitle}: ${edition.subtitle}` : baseTitle;
    const coverImageUrl = buildCoverUrl(edition.covers);
    const language = edition.languages?.[0]?.key ? String(edition.languages[0].key) : null;
    const publishers = (edition.publishers ?? []).map((value) => String(value).trim()).filter(Boolean).slice(0, 5);
    const result = explainImportClassification({
      title,
      subjects,
      publishers,
      language,
      coverImageUrl,
      isbn10,
      isbn13,
      pageCount: typeof edition.number_of_pages === "number" ? edition.number_of_pages : null,
      authorName: authorKeys[0] || "Unknown author",
    });
    const tier = result.tier;
    const sample = {
      title,
      author: authorKeys[0] || "Unknown author",
      reasons: result.reasons,
    };

    if (!canonicalId || tier === "reject") {
      rejected += 1;
      for (const reason of result.reasons) {
        rejectionReasons.set(reason, (rejectionReasons.get(reason) ?? 0) + 1);
      }
      if (preview && rejectedSamples.length < previewLimit) {
        rejectedSamples.push(sample);
      }
      continue;
    }

    if (!dryRun) {
      const existingBookByWork = primaryWorkKey ? await findBookByWorkKey(primaryWorkKey) : null;
      const existingBookByIsbn =
        isbn13 ? await findBookByIsbn(isbn13) : isbn10 ? await findBookByIsbn(isbn10) : null;
      const targetId = existingBookByWork?.id || existingBookByIsbn?.id || canonicalId;

      await upsertBook(
        new Book({
          id: targetId,
          externalId: edition.key || canonicalId,
          source: "openlibrary",
          workKey: primaryWorkKey || null,
          authorKeys,
          subjects,
          language,
          title,
          author: authorKeys[0] || "Unknown author",
          genre: subjects.slice(0, 3).join(", "),
          coverImageUrl,
          publishedAt: parsePublishedAt(edition.publish_date),
          pageCount: typeof edition.number_of_pages === "number" ? edition.number_of_pages : null,
          isbn10,
          isbn13,
          popularityScore:
            (tier === "tierA" ? 5 : 1) +
            subjects.length +
            (edition.isbn_13?.length ?? 0) +
            (edition.number_of_pages ? 1 : 0),
        })
      );
    }

    imported += 1;
    if (tier === "tierA") {
      tierAImported += 1;
      if (preview && tierASamples.length < previewLimit) {
        tierASamples.push(sample);
      }
    } else {
      tierBImported += 1;
      if (preview && tierBSamples.length < previewLimit) {
        tierBSamples.push(sample);
      }
    }

    if (imported % 500 === 0) {
      console.log(
        `${dryRun ? "Classified" : "Imported"} ${imported} editions (${scanned} scanned, rejected ${rejected}, tierA ${tierAImported}, tierB ${tierBImported})`
      );
    }

    if (limit > 0 && imported >= limit) {
      break;
    }

    if (scanLimit > 0 && scanned >= scanLimit) {
      break;
    }
  }

  console.log(
    `Done. ${dryRun ? "Classified" : "Imported"} ${imported} editions from ${resolvedFile}. Scanned ${scanned} rows. Rejected ${rejected}. TierA ${tierAImported}, TierB ${tierBImported}. Acceptance rate ${scanned > 0 ? ((imported / scanned) * 100).toFixed(2) : "0.00"}%.`
  );

  if (preview) {
    const topReasons = Array.from(rejectionReasons.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, previewLimit);

    console.log("\nPreview: top rejection reasons");
    for (const [reason, count] of topReasons) {
      console.log(`- ${reason}: ${count}`);
    }

    console.log("\nPreview: sample TierA rows");
    for (const row of tierASamples) {
      console.log(`- ${row.title} | ${row.author}`);
    }

    console.log("\nPreview: sample TierB rows");
    for (const row of tierBSamples) {
      console.log(`- ${row.title} | ${row.author}`);
    }

    console.log("\nPreview: sample rejected rows");
    for (const row of rejectedSamples) {
      console.log(`- ${row.title} | ${row.author} | ${row.reasons.join(", ")}`);
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
