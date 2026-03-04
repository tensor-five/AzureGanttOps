import { describe, expect, it } from "vitest";

import { enforceFlatQueryShape } from "./query-shape-policy.js";

describe("enforceFlatQueryShape", () => {
  it("accepts flat query type", () => {
    expect(() => enforceFlatQueryShape("flat")).not.toThrow();
    expect(() => enforceFlatQueryShape(" flat ")).not.toThrow();
    expect(() => enforceFlatQueryShape("FLAT")).not.toThrow();
  });

  it("rejects tree and one-hop query types", () => {
    expect(() => enforceFlatQueryShape("tree")).toThrow("QRY_SHAPE_UNSUPPORTED");
    expect(() => enforceFlatQueryShape("oneHop")).toThrow("QRY_SHAPE_UNSUPPORTED");
    expect(() => enforceFlatQueryShape("one-hop")).toThrow("QRY_SHAPE_UNSUPPORTED");
  });

  it("rejects unknown or invalid query types", () => {
    expect(() => enforceFlatQueryShape("custom")).toThrow("QRY_SHAPE_UNSUPPORTED");
    expect(() => enforceFlatQueryShape(42)).toThrow("QRY_SHAPE_UNSUPPORTED");
    expect(() => enforceFlatQueryShape(null)).toThrow("QRY_SHAPE_UNSUPPORTED");
    expect(() => enforceFlatQueryShape(undefined)).toThrow("QRY_SHAPE_UNSUPPORTED");
  });
});
