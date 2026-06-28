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

  it("anchors the trust badge panel below the status control", () => {
    const shellCss = readFileSync(path.join(bootstrapDir, "local-ui-shell.css"), "utf8");
    const panelRule = readCssRule(shellCss, ".trust-badge-panel");

    expect(panelRule).toContain("position: absolute;");
    expect(panelRule).toContain("box-sizing: border-box;");
    expect(panelRule).toContain("right: 12px;");
    expect(panelRule).toContain("top: calc(100% + 8px);");
    expect(panelRule).toContain("width: min(430px, calc(100vw - 24px));");
    expect(panelRule).toContain("max-height: min(72vh, calc(100vh - 32px));");
    expect(panelRule).not.toContain("position: fixed;");
    expect(panelRule).not.toContain("top: var(--ui-shell-overlay-top);");
  });

  it("keeps the shell header sticky in the normal layout flow", () => {
    const shellCss = readFileSync(path.join(bootstrapDir, "local-ui-shell.css"), "utf8");
    const mainRule = readCssRule(shellCss, 'main[data-ui-shell="phase-6-runtime"]');
    const headerRule = readCssRule(shellCss, ".ui-shell-header");
    const workspaceRule = readCssRule(shellCss, ".ui-shell-workspace");
    const panelRule = readCssRule(shellCss, ".trust-badge-panel");

    expect(mainRule).toContain("padding: 0 0 32px;");
    expect(mainRule).not.toContain("--ui-shell-header-offset");
    expect(mainRule).not.toContain("--ui-shell-overlay-top");
    expect(headerRule).toContain("position: sticky;");
    expect(headerRule).toContain("top: 0;");
    expect(headerRule).toContain("box-sizing: border-box;");
    expect(headerRule).toContain("width: 100%;");
    expect(headerRule).not.toContain("position: fixed;");
    expect(workspaceRule).toContain("position: static;");
    expect(workspaceRule).toContain("margin: 0 16px 0 auto;");
    expect(workspaceRule).toContain("max-height: min(72vh, calc(100vh - 32px));");
    expect(panelRule).toContain("position: absolute;");
    expect(panelRule).toContain("top: calc(100% + 8px);");
    expect(shellCss).not.toContain("padding-top: 70px;");
  });

  it("does not rely on estimated mobile header offsets", () => {
    const shellCss = readFileSync(path.join(bootstrapDir, "local-ui-shell.css"), "utf8");

    expect(shellCss).not.toContain("--ui-shell-header-offset");
    expect(shellCss).not.toContain("--ui-shell-overlay-top");
    expect(shellCss).not.toContain("--ui-shell-overlay-max-height");
    expect(shellCss).not.toContain("padding-top: var(--ui-shell-header-offset);");
    expect(shellCss).not.toMatch(/--ui-shell-(?:header-offset|overlay-top):\s*(?:180|188|196)px/);
  });

  it("keeps responsive trust badge panel sizing inside the header containing block", () => {
    const shellCss = readFileSync(path.join(bootstrapDir, "local-ui-shell.css"), "utf8");

    const responsiveRules = [
      {
        media: "@media (max-width: 1024px)",
        width: null
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
      if (width) {
        expect(panelRule).toContain(width);
        expect(panelRule).not.toContain("100vw");
      }
      expect(panelRule).not.toMatch(/right:\s*(?:6|8|10|12)px;/);
    }

    expect(readCssRuleAfter(shellCss, "@media (max-width: 768px)", ".trust-badge-details")).toContain("width: 100%;");
    expect(readCssRuleAfter(shellCss, "@media (max-width: 768px)", ".trust-badge-trigger")).toContain("width: 100%;");
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

  it("keeps the compact release badge inside the shell header contract", () => {
    const shellCss = readFileSync(path.join(bootstrapDir, "local-ui-shell.css"), "utf8");
    const brandRowRule = readCssRule(shellCss, ".ui-shell-brand-row");
    const badgeGroupRule = readCssRule(shellCss, ".app-release-badge-group");
    const badgeRule = readCssRule(shellCss, ".app-release-badge");
    const shortcutsRule = readCssRule(shellCss, ".app-release-shortcuts-button");
    const indicatorRule = readCssRule(shellCss, ".app-release-update-indicator");
    const responsiveBrandRowRule = readCssRuleAfter(shellCss, "@media (max-width: 768px)", ".ui-shell-brand-row");

    expect(brandRowRule).toContain("display: inline-flex;");
    expect(brandRowRule).toContain("align-items: center;");
    expect(brandRowRule).toContain("flex-wrap: wrap;");
    expect(badgeGroupRule).toContain("display: inline-flex;");
    expect(badgeGroupRule).toContain("align-items: center;");
    expect(badgeGroupRule).toContain("gap: 4px;");
    expect(badgeRule).toContain("appearance: none;");
    expect(badgeRule).toContain("min-height: 36px;");
    expect(badgeRule).toContain("border-radius: var(--radius-pill);");
    expect(badgeRule).toContain("font: inherit;");
    expect(badgeRule).toContain("cursor: pointer;");
    expect(badgeRule).toContain("white-space: nowrap;");
    expect(shortcutsRule).toContain("width: 30px;");
    expect(shortcutsRule).toContain("height: 30px;");
    expect(shortcutsRule).toContain("border-radius: var(--radius-pill);");
    expect(shortcutsRule).toContain("cursor: pointer;");
    expect(indicatorRule).toContain("width: 22px;");
    expect(indicatorRule).toContain("height: 22px;");
    expect(indicatorRule).toContain("border-radius: var(--radius-pill);");
    expect(indicatorRule).toContain("cursor: pointer;");
    expect(responsiveBrandRowRule).toContain("width: 100%;");
  });

  it("keeps the changelog dialog bounded and internally scrollable", () => {
    const shellCss = readFileSync(path.join(bootstrapDir, "local-ui-shell.css"), "utf8");
    const backdropRule = readCssRule(shellCss, ".app-dialog-backdrop");
    const legacyBackdropRule = readCssRule(shellCss, ".app-changelog-backdrop");
    const dialogRule = readCssRule(shellCss, ".app-dialog");
    const legacyDialogRule = readCssRule(shellCss, ".app-changelog-dialog");
    const headerRule = readCssRule(shellCss, ".app-dialog-header");
    const closeRule = readCssRule(shellCss, ".app-dialog-close");
    const contentRule = readCssRule(shellCss, ".app-dialog-content");
    const updateNoticeRule = readCssRule(shellCss, ".app-update-notice");
    const markdownRule = readCssRule(shellCss, ".app-changelog-markdown");
    const responsiveDialogRule = readCssRuleAfter(shellCss, "@media (max-width: 640px)", ".app-dialog");

    expect(backdropRule).toContain("position: fixed;");
    expect(legacyBackdropRule).toBe(backdropRule);
    expect(legacyDialogRule).toBe(dialogRule);
    expect(backdropRule).toContain("inset: 0;");
    expect(backdropRule).toContain("place-items: center;");
    expect(dialogRule).toContain("width: min(760px, calc(100vw - 32px));");
    expect(dialogRule).toContain("max-height: min(82vh, calc(100vh - 32px));");
    expect(dialogRule).toContain("overflow: hidden;");
    expect(dialogRule).toContain("display: flex;");
    expect(dialogRule).toContain("flex-direction: column;");
    expect(headerRule).toContain("justify-content: space-between;");
    expect(closeRule).toContain("width: 36px;");
    expect(closeRule).toContain("height: 36px;");
    expect(closeRule).toContain("cursor: pointer;");
    expect(contentRule).toContain("overflow: auto;");
    expect(updateNoticeRule).toContain("border: 1px solid var(--color-warning-border);");
    expect(updateNoticeRule).toContain("overflow-wrap: anywhere;");
    expect(markdownRule).toContain("line-height: 1.58;");
    expect(responsiveDialogRule).toContain("width: calc(100vw - 20px);");
    expect(responsiveDialogRule).toContain("max-height: calc(100vh - 20px);");
  });

  it("keeps keyboard shortcuts dialog content compact and responsive", () => {
    const shellCss = readFileSync(path.join(bootstrapDir, "local-ui-shell.css"), "utf8");
    const contentRule = readCssRule(shellCss, ".app-keyboard-shortcuts-content");
    const shortcutsRule = readCssRule(shellCss, ".app-keyboard-shortcuts");
    const itemRule = readCssRule(shellCss, ".app-keyboard-shortcut-item");
    const keyRule = readCssRule(shellCss, ".app-keyboard-shortcut-keys kbd");
    const descriptionRule = readCssRule(shellCss, ".app-keyboard-shortcut-description");
    const responsiveItemRule = readCssRuleAfter(shellCss, "@media (max-width: 640px)", ".app-keyboard-shortcut-item");

    expect(contentRule).toContain("min-height: 0;");
    expect(shortcutsRule).toContain("display: grid;");
    expect(shortcutsRule).toContain("gap: 18px;");
    expect(itemRule).toContain("grid-template-columns: minmax(128px, 188px) minmax(0, 1fr);");
    expect(itemRule).toContain("border-radius: var(--radius-sm);");
    expect(keyRule).toContain("white-space: nowrap;");
    expect(descriptionRule).toContain("overflow-wrap: anywhere;");
    expect(responsiveItemRule).toContain("grid-template-columns: minmax(0, 1fr);");
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
  const rulePattern = /(?<selectors>[^{}]+)\{(?<body>[^{}]*)\}/g;
  const matches: Array<{ selectors: string[]; body: string }> = [];

  for (const match of css.matchAll(rulePattern)) {
    const selectors = match.groups?.selectors.split(",").map((item) => item.trim()) ?? [];
    if (selectors.includes(selector) && match.groups?.body) {
      matches.push({ selectors, body: match.groups.body });
    }
  }

  const exactMatch = matches.find((match) => match.selectors.length === 1);
  if (exactMatch) {
    return exactMatch.body;
  }

  if (matches[0]) {
    return matches[0].body;
  }

  throw new Error(`Missing CSS rule for ${selector}`);
}

function readCssRuleAfter(css: string, marker: string, selector: string): string {
  const markerIndex = css.indexOf(marker);

  if (markerIndex === -1) {
    throw new Error(`Missing CSS marker ${marker}`);
  }

  return readCssRule(css.slice(markerIndex), selector);
}
