import { describe, expect, it } from "vitest";

import { resolveChildWorkItemType } from "./child-work-item-type.js";

describe("resolveChildWorkItemType", () => {
  it("maps supported parent types to their child work item type", () => {
    expect(resolveChildWorkItemType("Epic")).toBe("Feature");
    expect(resolveChildWorkItemType("EpicPPM")).toBe("Feature");
    expect(resolveChildWorkItemType("Feature")).toBe("User Story");
    expect(resolveChildWorkItemType("User Story")).toBe("Task");
  });

  it("normalizes casing and surrounding whitespace", () => {
    expect(resolveChildWorkItemType(" epic ")).toBe("Feature");
    expect(resolveChildWorkItemType("EPICPPM")).toBe("Feature");
    expect(resolveChildWorkItemType(" user   story ")).toBe("Task");
  });

  it("returns null for unsupported or missing parent types", () => {
    expect(resolveChildWorkItemType("Task")).toBeNull();
    expect(resolveChildWorkItemType("Bug")).toBeNull();
    expect(resolveChildWorkItemType("")).toBeNull();
    expect(resolveChildWorkItemType(null)).toBeNull();
    expect(resolveChildWorkItemType(undefined)).toBeNull();
  });
});
