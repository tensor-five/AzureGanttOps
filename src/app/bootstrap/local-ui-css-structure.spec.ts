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

  it("uses warning tokens for the local config reset error state", () => {
    const shellCss = readFileSync(path.join(bootstrapDir, "local-ui-shell.css"), "utf8");

    expect(shellCss).toMatch(
      /\.local-config-reset-error\s*\{[\s\S]*border:\s*1px solid var\(--color-warning-border\)/
    );
    expect(shellCss).toMatch(/\.local-config-reset-error\s*\{[\s\S]*background:\s*var\(--color-warning-bg\)/);
    expect(shellCss).toMatch(/\.local-config-reset-error\s*\{[\s\S]*color:\s*var\(--color-warning-text\)/);
  });

  it("keeps the trust badge panel viewport anchored", () => {
    const shellCss = readFileSync(path.join(bootstrapDir, "local-ui-shell.css"), "utf8");
    const panelRule = readCssRule(shellCss, ".trust-badge-panel");

    expect(panelRule).toContain("position: fixed;");
    expect(panelRule).toContain("box-sizing: border-box;");
    expect(panelRule).toContain("right: 12px;");
    expect(panelRule).toContain("top: 64px;");
    expect(panelRule).toContain("width: min(430px, calc(100vw - 24px));");
    expect(panelRule).toContain("max-height: calc(100vh - 76px);");
    expect(panelRule).not.toContain("position: absolute;");
    expect(panelRule).not.toContain("top: calc(100% + 8px);");
  });

  it("keeps responsive trust badge panel sizing inside the header containing block", () => {
    const shellCss = readFileSync(path.join(bootstrapDir, "local-ui-shell.css"), "utf8");

    const responsiveRules = [
      {
        media: "@media (max-width: 1024px)",
        width: "width: min(430px, 100%);"
      },
      {
        media: "@media (max-width: 768px)",
        width: "width: 100%;"
      },
      {
        media: "@media (max-width: 640px)",
        width: "width: 100%;"
      },
      {
        media: "@media (max-width: 480px)",
        width: "width: 100%;"
      }
    ];

    for (const { media, width } of responsiveRules) {
      const panelRule = readCssRuleAfter(shellCss, media, ".trust-badge-panel");

      expect(panelRule).toContain("right: 0;");
      expect(panelRule).toContain(width);
      expect(panelRule).not.toContain("100vw");
      expect(panelRule).not.toMatch(/right:\s*(?:6|8|10|12)px;/);
    }
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

function readCssRule(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escapedSelector}\\s*\\{(?<body>[\\s\\S]*?)\\}`).exec(css);

  if (!match?.groups?.body) {
    throw new Error(`Missing CSS rule for ${selector}`);
  }

  return match.groups.body;
}

function readCssRuleAfter(css: string, marker: string, selector: string): string {
  const markerIndex = css.indexOf(marker);

  if (markerIndex === -1) {
    throw new Error(`Missing CSS marker ${marker}`);
  }

  return readCssRule(css.slice(markerIndex), selector);
}
