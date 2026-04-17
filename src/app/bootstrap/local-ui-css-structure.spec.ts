import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("local UI CSS structure", () => {
  const bootstrapDir = path.resolve(process.cwd(), "src/app/bootstrap");

  it("keeps local-ui.css as split entrypoint", () => {
    const cssEntry = readFileSync(path.join(bootstrapDir, "local-ui.css"), "utf8");
    const normalizedImports = cssEntry
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("@import"));

    expect(normalizedImports).toMatchInlineSnapshot(`
      [
        "@import \"./local-ui-tokens.css\";",
        "@import \"./local-ui-base.css\";",
        "@import \"./local-ui-shell.css\";",
      ]
    `);
  });

  it("retains required shell selectors after css split", () => {
    const shellCss = readFileSync(path.join(bootstrapDir, "local-ui-shell.css"), "utf8");

    expect(shellCss).toContain(".timeline-pane-actions");
    expect(shellCss).toContain(".timeline-details-input");
  });

  it("retains required token contract", () => {
    const tokenCss = readFileSync(path.join(bootstrapDir, "local-ui-tokens.css"), "utf8");

    expect(tokenCss).toContain("--color-bg");
    expect(tokenCss).toContain("--color-text");
    expect(tokenCss).toContain("--space-2");
  });
});
