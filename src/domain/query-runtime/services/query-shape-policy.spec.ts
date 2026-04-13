import { describe, expect, it } from "vitest";

import { resolveQueryShape } from "./query-shape-policy.js";

describe("resolveQueryShape", () => {
  it("resolves flat query type", () => {
    expect(resolveQueryShape("flat")).toBe("flat");
    expect(resolveQueryShape(" flat ")).toBe("flat");
    expect(resolveQueryShape("FLAT")).toBe("flat");
  });

  it("resolves tree query type", () => {
    expect(resolveQueryShape("tree")).toBe("tree");
    expect(resolveQueryShape("Tree")).toBe("tree");
  });

  it("resolves oneHop query type", () => {
    expect(resolveQueryShape("oneHop")).toBe("oneHop");
    expect(resolveQueryShape("one-hop")).toBe("oneHop");
    expect(resolveQueryShape("ONEHOP")).toBe("oneHop");
  });

  it("rejects unknown or invalid query types", () => {
    expect(() => resolveQueryShape("custom")).toThrow("QRY_SHAPE_UNSUPPORTED");
    expect(() => resolveQueryShape(42)).toThrow("QRY_SHAPE_UNSUPPORTED");
    expect(() => resolveQueryShape(null)).toThrow("QRY_SHAPE_UNSUPPORTED");
    expect(() => resolveQueryShape(undefined)).toThrow("QRY_SHAPE_UNSUPPORTED");
  });
});
