import { spawnSync } from "node:child_process";

const forwarded = ["run", "src/features/query-switching/query-intake.e2e.spec.ts"];
const args = process.argv.slice(2);

for (let index = 0; index < args.length; index += 1) {
  const current = args[index];

  if (current === "--grep") {
    const pattern = args[index + 1] ?? "";
    if (pattern.length > 0) {
      forwarded.push(`--testNamePattern=${pattern}`);
      index += 1;
      continue;
    }
  }

  forwarded.push(current);
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vitest", ...forwarded],
  { stdio: "inherit" }
);

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
