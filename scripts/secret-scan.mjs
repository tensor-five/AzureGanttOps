import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const MAX_SCAN_BYTES = 1024 * 1024;
const DEFAULT_IGNORED_PREFIXES = ["node_modules/", "dist/", ".planning/", "test-results/"];
const DEFAULT_IGNORED_FILES = new Set(["tests/e2e/runtime-harness.js"]);
const TEST_FILE_PATTERN = /\.(?:spec|test)\.[cm]?[jt]sx?$/;

const DETECTORS = [
  { id: "private-key", regex: /-----BEGIN (?:RSA|EC|OPENSSH|DSA|PGP|PRIVATE) KEY-----/ },
  { id: "aws-access-key", regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: "github-token", regex: /\bghp_[A-Za-z0-9]{36}\b/ },
  { id: "github-pat", regex: /\bgithub_pat_[A-Za-z0-9_]{82}\b/ },
  { id: "google-api-key", regex: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { id: "slack-token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: "bearer-token", regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/i },
  { id: "jwt", regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.?[A-Za-z0-9_-]*\b/ }
];

function listTrackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  return output.split("\0").filter(Boolean);
}

function listStagedFiles() {
  const output = execFileSync("git", ["diff", "--cached", "--name-only", "-z"], { encoding: "utf8" });
  return output.split("\0").filter(Boolean);
}

function normalizeCliFiles(args) {
  const filesIndex = args.indexOf("--files");
  if (filesIndex !== -1) {
    return args.slice(filesIndex + 1);
  }

  if (args.includes("--staged")) {
    return listStagedFiles();
  }

  return listTrackedFiles();
}

function shouldSkip(relativePath) {
  if (DEFAULT_IGNORED_FILES.has(relativePath)) {
    return true;
  }

  if (TEST_FILE_PATTERN.test(relativePath)) {
    return true;
  }

  return DEFAULT_IGNORED_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function isBinaryOrTooLarge(relativePath) {
  const absolutePath = path.resolve(relativePath);

  try {
    const fileStat = statSync(absolutePath);
    if (!fileStat.isFile()) {
      return true;
    }

    if (fileStat.size > MAX_SCAN_BYTES) {
      return true;
    }
  } catch {
    return true;
  }

  const buffer = readFileSync(absolutePath);
  return buffer.includes(0);
}

function scanFile(relativePath) {
  const absolutePath = path.resolve(relativePath);
  const content = readFileSync(absolutePath, "utf8");
  const lines = content.split(/\r?\n/);
  const findings = [];

  lines.forEach((line, lineIndex) => {
    for (const detector of DETECTORS) {
      if (detector.regex.test(line)) {
        findings.push({
          file: relativePath,
          line: lineIndex + 1,
          detector: detector.id
        });
        break;
      }
    }
  });

  return findings;
}

function main() {
  const candidates = normalizeCliFiles(process.argv.slice(2));
  const files = [...new Set(candidates.filter((file) => file && !shouldSkip(file)))];

  const findings = [];
  for (const file of files) {
    if (isBinaryOrTooLarge(file)) {
      continue;
    }
    findings.push(...scanFile(file));
  }

  if (findings.length === 0) {
    console.log("secret-scan: no high-confidence secrets detected.");
    return;
  }

  console.error("secret-scan: potential secrets detected:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} (${finding.detector})`);
  }
  process.exitCode = 1;
}

main();
