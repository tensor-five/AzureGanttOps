import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, it } from "vitest";

const LA_TIMEZONE_CHILD_ENV = "TIMELINE_SCHEDULE_TIMEZONE_LA_CHILD";
const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../..");
const childSpecPath = resolve(currentDir, "timeline-schedule-timezone.la.spec.ts");
const vitestCliPath = resolve(repoRoot, "node_modules/vitest/vitest.mjs");
const vitestConfigPath = resolve(repoRoot, "vitest.config.ts");

describe("timeline schedule timezone subprocess", () => {
  it("runs hard LA schedule assertions in a dedicated America/Los_Angeles process", () => {
    const result = spawnSync(
      process.execPath,
      [vitestCliPath, "run", childSpecPath, "--config", vitestConfigPath, "--reporter=dot"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          TZ: "America/Los_Angeles",
          [LA_TIMEZONE_CHILD_ENV]: "1"
        }
      }
    );

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      throw new Error(
        [
          `LA timezone subprocess failed with status ${String(result.status)}.`,
          result.stdout.trim(),
          result.stderr.trim()
        ]
          .filter(Boolean)
          .join("\n\n")
      );
    }
  });
});
