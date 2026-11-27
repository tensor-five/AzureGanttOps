import { describe, expect, it } from "vitest";

import {
  findHashMismatches,
  findUnapprovedManifestChanges,
  parseManifest,
  sha256
} from "./verify-frozen-artifacts.mjs";

describe("parseManifest", () => {
  it("parses sha256sum lines and skips comments", () => {
    const hash = "a".repeat(64);
    expect(parseManifest(`# frozen\n${hash}  docs/contracts/x.html\n`)).toEqual([
      { hash, filePath: "docs/contracts/x.html" }
    ]);
  });

  it("rejects malformed lines", () => {
    expect(() => parseManifest("nope docs/x")).toThrow("Invalid manifest line");
  });
});

describe("findHashMismatches", () => {
  it("accepts matching files and reports changed or missing ones", () => {
    const files = { "a.txt": Buffer.from("alpha"), "b.txt": Buffer.from("beta") };
    const entries = [
      { hash: sha256("alpha"), filePath: "a.txt" },
      { hash: sha256("other"), filePath: "b.txt" },
      { hash: sha256("gone"), filePath: "c.txt" }
    ];
    const problems = findHashMismatches(entries, (filePath) => files[filePath] ?? null);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("b.txt: expected");
    expect(problems[1]).toBe("c.txt: file is missing");
  });
});

describe("findUnapprovedManifestChanges", () => {
  it("allows new manifests but flags changed or removed ones from the base branch", () => {
    const base = new Map([
      ["docs/contracts/one.sha256", "x"],
      ["docs/contracts/two.sha256", "y"]
    ]);
    const current = new Map([
      ["docs/contracts/one.sha256", "x-changed"],
      ["docs/contracts/three.sha256", "z"]
    ]);
    expect(findUnapprovedManifestChanges(current, base)).toEqual([
      "docs/contracts/one.sha256: frozen manifest changed compared to the base branch",
      "docs/contracts/two.sha256: frozen manifest was removed"
    ]);
  });
});
