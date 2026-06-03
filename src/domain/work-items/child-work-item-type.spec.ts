import { describe, expect, it } from "vitest";

import {
  normalizeAvailableWorkItemTypes,
  resolveDefaultChildWorkItemType,
  resolvePreferredChildWorkItemType
} from "./child-work-item-type.js";

describe("resolvePreferredChildWorkItemType", () => {
  it("maps known hierarchy parent types to their preferred child work item type", () => {
    expect(resolvePreferredChildWorkItemType("Epic")).toBe("Feature");
    expect(resolvePreferredChildWorkItemType("EpicPPM")).toBe("Feature");
    expect(resolvePreferredChildWorkItemType("Feature")).toBe("User Story");
    expect(resolvePreferredChildWorkItemType("User Story")).toBe("Task");
  });

  it("normalizes casing and surrounding whitespace", () => {
    expect(resolvePreferredChildWorkItemType(" epic ")).toBe("Feature");
    expect(resolvePreferredChildWorkItemType("EPICPPM")).toBe("Feature");
    expect(resolvePreferredChildWorkItemType(" user   story ")).toBe("Task");
  });

  it("returns null for parent types without a hierarchy preference", () => {
    expect(resolvePreferredChildWorkItemType("Task")).toBeNull();
    expect(resolvePreferredChildWorkItemType("Bug")).toBeNull();
    expect(resolvePreferredChildWorkItemType("")).toBeNull();
    expect(resolvePreferredChildWorkItemType(null)).toBeNull();
    expect(resolvePreferredChildWorkItemType(undefined)).toBeNull();
  });
});

describe("normalizeAvailableWorkItemTypes", () => {
  it("trims, deduplicates case-insensitively, and sorts work item types alphabetically", () => {
    expect(
      normalizeAvailableWorkItemTypes([
        { name: "  User Story  " },
        { name: "Task" },
        { name: "feature" },
        { name: "Feature" },
        { name: "" },
        " Bug "
      ])
    ).toEqual(["Bug", "feature", "Task", "User Story"]);
  });

  it("returns an empty list when no available types are provided", () => {
    expect(normalizeAvailableWorkItemTypes(null)).toEqual([]);
    expect(normalizeAvailableWorkItemTypes(undefined)).toEqual([]);
  });
});

describe("resolveDefaultChildWorkItemType", () => {
  it("uses the preferred hierarchy type when it exists in the available list", () => {
    expect(
      resolveDefaultChildWorkItemType("Feature", [
        { name: "Task" },
        { name: " user story " },
        { name: "Bug" }
      ])
    ).toBe("user story");
  });

  it("falls back to the first alphabetic type when the preference is unavailable", () => {
    expect(resolveDefaultChildWorkItemType("Feature", ["Task", "Bug", "Custom Child"])).toBe("Bug");
  });

  it("works for parent types without a hierarchy preference", () => {
    expect(resolveDefaultChildWorkItemType("Task", ["Spike", "Bug"])).toBe("Bug");
  });

  it("returns null when no usable child type exists", () => {
    expect(resolveDefaultChildWorkItemType("Epic", [])).toBeNull();
  });
});
