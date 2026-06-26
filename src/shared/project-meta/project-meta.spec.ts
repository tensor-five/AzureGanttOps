import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { APP_VERSION, CHANGELOG_PATH } from "./project-meta.js";

describe("project-meta", () => {
  it("keeps the app version aligned with package.json", () => {
    const packageJson = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")) as {
      version?: unknown;
    };

    expect(packageJson.version).toBe(APP_VERSION);
  });

  it("keeps the changelog path and current changelog heading aligned", () => {
    const changelog = readFileSync(path.resolve(process.cwd(), CHANGELOG_PATH.slice(1)), "utf8");

    expect(CHANGELOG_PATH).toBe("/CHANGELOG.md");
    expect(changelog).toContain(`## [${APP_VERSION}] - 2026-06-26`);
  });
});
