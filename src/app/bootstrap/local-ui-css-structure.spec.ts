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

  it("uses local brand title typography in the shell header", () => {
    const shellCss = readFileSync(path.join(bootstrapDir, "local-ui-shell.css"), "utf8");

    expect(shellCss).not.toMatch(/^@import\b/im);
    expect(shellCss).not.toMatch(/fontshare/i);
    expect(shellCss).not.toContain("Satoshi");
    expect(shellCss).toMatch(/\.ui-shell-brand h1\s*\{[\s\S]*font-family:\s*var\(--font-display\)/);
    expect(shellCss).toMatch(/\.ui-shell-brand h1\s*\{[\s\S]*font-weight:\s*var\(--font-black\)/);
    expect(shellCss).toMatch(/\.ui-shell-brand h1\s*\{[\s\S]*letter-spacing:\s*0/);
  });

  it("retains required token contract", () => {
    const tokenCss = readFileSync(path.join(bootstrapDir, "local-ui-tokens.css"), "utf8");

    expect(tokenCss).toContain("--font-display");
    expect(tokenCss).toContain("--font-body");
    expect(tokenCss).toContain("--color-bg");
    expect(tokenCss).toContain("--color-text");
    expect(tokenCss).toContain("--space-2");
  });

  it("keeps font tokens local without external font imports", () => {
    const tokenCss = readFileSync(path.join(bootstrapDir, "local-ui-tokens.css"), "utf8");

    expect(tokenCss).not.toMatch(/^@import\b/im);
    expect(tokenCss).not.toMatch(/fontshare/i);
    expect(tokenCss).not.toContain("Satoshi");
    expect(tokenCss).toMatch(/--font-display:\s*system-ui,/);
    expect(tokenCss).toMatch(/--font-body:\s*system-ui,/);
  });
});
