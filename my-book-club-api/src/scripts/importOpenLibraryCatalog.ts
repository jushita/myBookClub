import { spawn } from "node:child_process";
import path from "node:path";
import "../config/env.js";

function getArg(name: string): string | undefined {
  const index = process.argv.findIndex((value) => value === `--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runStep(step: string, scriptPath: string, args: string[]) {
  console.log(`\n==> ${step}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", ["tsx", scriptPath, ...args], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${step} failed with exit code ${code ?? 1}`));
    });

    child.on("error", reject);
  });
}

async function main() {
  const worksFile = getArg("works-file");
  const editionsFile = getArg("editions-file");
  const authorsFile = getArg("authors-file");
  const limit = getArg("limit");
  const scanLimit = getArg("scan-limit");
  const dryRun = process.argv.includes("--dry-run");
  const preview = process.argv.includes("--preview");
  const previewLimit = getArg("preview-limit");
  const cwd = process.cwd();

  if (!worksFile || !editionsFile || !authorsFile) {
    throw new Error(
      "Missing file arguments. Example: npm run db:import:catalog -- --works-file /path/ol_dump_works_latest.txt.gz --editions-file /path/ol_dump_editions_latest.txt.gz --authors-file /path/ol_dump_authors_latest.txt.gz --limit 5000"
    );
  }

  const worksScript = path.join(cwd, "src/scripts/importOpenLibraryWorks.ts");
  const editionsScript = path.join(cwd, "src/scripts/importOpenLibraryEditions.ts");
  const authorsScript = path.join(cwd, "src/scripts/importOpenLibraryAuthors.ts");

  const sharedArgs = [
    ...(limit ? ["--limit", limit] : []),
    ...(scanLimit ? ["--scan-limit", scanLimit] : []),
    ...(dryRun ? ["--dry-run"] : []),
    ...(preview ? ["--preview"] : []),
    ...(previewLimit ? ["--preview-limit", previewLimit] : []),
  ];

  await runStep("Importing works", worksScript, ["--file", worksFile, ...sharedArgs]);
  await runStep("Importing editions", editionsScript, ["--file", editionsFile, ...sharedArgs]);
  await runStep("Importing authors", authorsScript, ["--file", authorsFile, ...sharedArgs]);

  console.log("\nDone. Open Library catalog import completed.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
