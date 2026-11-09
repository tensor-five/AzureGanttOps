import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MANIFEST_ROOT = "docs/contracts";
export const MANIFEST_SUFFIX = ".sha256";

export function parseManifest(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const match = /^([a-f0-9]{64})\s+\*?(.+)$/.exec(line);
      if (!match) {
        throw new Error(`Invalid manifest line: ${line}`);
      }
      return { hash: match[1], filePath: match[2].trim() };
    });
}

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export function findHashMismatches(entries, readFile) {
  const problems = [];
  for (const entry of entries) {
    const content = readFile(entry.filePath);
    if (content === null) {
      problems.push(`${entry.filePath}: file is missing`);
      continue;
    }
    const actual = sha256(content);
    if (actual !== entry.hash) {
      problems.push(`${entry.filePath}: expected ${entry.hash}, got ${actual}`);
    }
  }
  return problems;
}

export function findUnapprovedManifestChanges(currentManifests, baseManifests) {
  const problems = [];
  for (const [manifestPath, baseContent] of baseManifests) {
    const currentContent = currentManifests.get(manifestPath);
    if (currentContent === undefined) {
      problems.push(`${manifestPath}: frozen manifest was removed`);
      continue;
    }
    if (currentContent !== baseContent) {
      problems.push(`${manifestPath}: frozen manifest changed compared to the base branch`);
    }
  }
  return problems;
}

async function listManifests(root) {
  const results = [];
  async function walk(directory) {
    let entries = [];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith(MANIFEST_SUFFIX)) {
        results.push(path.relative(process.cwd(), fullPath).split(path.sep).join("/"));
      }
    }
  }
  await walk(path.join(process.cwd(), root));
  return results.sort();
}

function listBaseManifests(baseRef) {
  const output = execFileSync("git", ["ls-tree", "-r", "--name-only", baseRef, "--", MANIFEST_ROOT], { encoding: "utf8" });
  const manifests = new Map();
  output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.endsWith(MANIFEST_SUFFIX))
    .forEach((manifestPath) => {
      manifests.set(manifestPath, execFileSync("git", ["show", `${baseRef}:${manifestPath}`], { encoding: "utf8" }));
    });
  return manifests;
}

function readFileOrNull(filePath) {
  try {
    return readFileSync(filePath);
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf("--base");
  const baseRef = baseIndex >= 0 ? args[baseIndex + 1] : null;
  const changeApproved = process.env.FROZEN_CHANGE_APPROVED === "true";

  const manifestPaths = await listManifests(MANIFEST_ROOT);
  const currentManifests = new Map();
  const problems = [];

  for (const manifestPath of manifestPaths) {
    const content = await fs.readFile(manifestPath, "utf8");
    currentManifests.set(manifestPath, content);
    try {
      problems.push(...findHashMismatches(parseManifest(content), readFileOrNull).map((problem) => `${manifestPath} -> ${problem}`));
    } catch (error) {
      problems.push(`${manifestPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (baseRef) {
    const changes = findUnapprovedManifestChanges(currentManifests, listBaseManifests(baseRef));
    if (changes.length > 0 && !changeApproved) {
      problems.push(...changes.map((change) => `${change} (requires the PR label "approved-frozen-change")`));
    }
  }

  if (problems.length > 0) {
    console.error("Frozen artifact check failed:");
    problems.forEach((problem) => console.error(`- ${problem}`));
    process.exit(1);
  }

  console.log(`Frozen artifact check passed. Verified ${manifestPaths.length} manifest(s).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
