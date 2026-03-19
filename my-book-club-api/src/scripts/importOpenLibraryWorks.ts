import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import "../config/env.js";
import { upsertBook } from "../repositories/books.js";
import { Book } from "../domain/entities/Book.js";
import { explainImportClassification } from "./openLibraryImportRules.js";

type OpenLibraryAuthorRef = {
  author?: {
    key?: string;
  };
};

type OpenLibraryDescription = {
  value?: string;
};

type OpenLibraryWork = {
  key?: string;
  title?: string;
  description?: string | OpenLibraryDescription;
  subjects?: string[];
  covers?: number[];
  authors?: OpenLibraryAuthorRef[];
  first_publish_date?: string;
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

function extractDescription(description: OpenLibraryWork["description"]): string {
  if (!description) {
    return "";
  }

  if (typeof description === "string") {
    return description.trim();
  }

  return String(description.value || "").trim();
}

function buildCoverUrl(covers: number[] | undefined): string | null {
  const coverId = covers?.[0];
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
}

function parsePublishedAt(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const yearMatch = value.match(/\d{4}/);
  return yearMatch ? new Date(`${yearMatch[0]}-01-01T00:00:00.000Z`) : null;
}

async function main() {
  const file = getArg("file");
  const limit = Number(getArg("limit") || "0");
  const scanLimit = Number(getArg("scan-limit") || "0");
  const dryRun = process.argv.includes("--dry-run");
  const preview = process.argv.includes("--preview");
  const previewLimit = Number(getArg("preview-limit") || "5");

  if (!file) {
    throw new Error("Missing --file argument. Example: npm run db:import:works -- --file /path/to/ol_dump_works_latest.txt.gz --limit 5000");
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

    let work: OpenLibraryWork;
    try {
      work = JSON.parse(payload) as OpenLibraryWork;
    } catch {
      continue;
    }

    const subjects = (work.subjects ?? []).map((value) => String(value).trim()).filter(Boolean).slice(0, 20);
    const authorKeys = (work.authors ?? [])
      .map((author) => author.author?.key)
      .filter((value): value is string => Boolean(value))
      .slice(0, 5);
    const description = extractDescription(work.description);
    const coverImageUrl = buildCoverUrl(work.covers);
    const language = work.languages?.[0]?.key ? String(work.languages[0].key) : null;
    const result = explainImportClassification({
      title: work.title,
      description,
      subjects,
      language,
      coverImageUrl,
      authorName: authorKeys[0] || "Unknown author",
    });
    const tier = result.tier;
    const sample = {
      title: work.title || "",
      author: authorKeys[0] || "Unknown author",
      reasons: result.reasons,
    };

    if (tier === "reject" || !work.key || !work.title) {
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
      await upsertBook(
        new Book({
          id: work.key,
          externalId: work.key,
          source: "openlibrary",
          workKey: work.key,
          authorKeys,
          subjects,
          language,
          title: work.title,
          author: authorKeys[0] || "Unknown author",
          genre: subjects.slice(0, 3).join(", "),
          description,
          synopsis: description,
          coverImageUrl,
          publishedAt: parsePublishedAt(work.first_publish_date),
          popularityScore: tier === "tierA" ? subjects.length + 5 : subjects.length + 1,
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
        `${dryRun ? "Classified" : "Imported"} ${imported} works (${scanned} scanned, rejected ${rejected}, tierA ${tierAImported}, tierB ${tierBImported})`
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
    `Done. ${dryRun ? "Classified" : "Imported"} ${imported} works from ${resolvedFile}. Scanned ${scanned} rows. Rejected ${rejected}. TierA ${tierAImported}, TierB ${tierBImported}. Acceptance rate ${scanned > 0 ? ((imported / scanned) * 100).toFixed(2) : "0.00"}%.`
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
