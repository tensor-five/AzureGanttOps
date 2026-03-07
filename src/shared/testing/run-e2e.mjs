import { spawnSync } from "node:child_process";

const buildResult = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "build"],
  { stdio: "inherit" }
);

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const harnessBuildResult = spawnSync(
  process.platform === "win32" ? "node.exe" : "node",
  ["./tests/e2e/build-harness.mjs"],
  { stdio: "inherit" }
);

if (harnessBuildResult.status !== 0) {
  process.exit(harnessBuildResult.status ?? 1);
}

const forwarded = ["test", "--config", "playwright.config.ts"];
const args = process.argv.slice(2);

for (let index = 0; index < args.length; index += 1) {
  const current = args[index];

  if (current === "--grep") {
    const pattern = args[index + 1] ?? "";
    if (pattern.length > 0) {
      forwarded.push("--grep", pattern);
      index += 1;
      continue;
    }
  }

  forwarded.push(current);
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["playwright", ...forwarded],
  { stdio: "inherit" }
);

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
