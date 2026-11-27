import { describe, expect, it } from "vitest";

import { compareSimpleSemver, parseSimpleSemver } from "./version-comparison.js";

describe("version-comparison", () => {
  it("detects greater versions by major, minor and patch", () => {
    expect(compareSimpleSemver("2.0.0", "1.9.9")).toBe("greater");
    expect(compareSimpleSemver("1.3.0", "1.2.9")).toBe("greater");
    expect(compareSimpleSemver("1.2.4", "1.2.3")).toBe("greater");
  });

  it("detects equal versions and tolerates a v prefix", () => {
    expect(compareSimpleSemver("1.2.3", "1.2.3")).toBe("equal");
    expect(compareSimpleSemver("v1.2.3", "1.2.3")).toBe("equal");
    expect(compareSimpleSemver("1.2.3", "v1.2.3")).toBe("equal");
  });

  it("detects lower versions by major, minor and patch", () => {
    expect(compareSimpleSemver("1.9.9", "2.0.0")).toBe("less");
    expect(compareSimpleSemver("1.2.9", "1.3.0")).toBe("less");
    expect(compareSimpleSemver("1.2.3", "1.2.4")).toBe("less");
  });

  it("returns null for malformed versions", () => {
    expect(compareSimpleSemver("1.2", "1.2.3")).toBeNull();
    expect(compareSimpleSemver("1.2.3-beta.1", "1.2.3")).toBeNull();
    expect(compareSimpleSemver("1.2.3", "latest")).toBeNull();
    expect(parseSimpleSemver("")).toBeNull();
  });
});
