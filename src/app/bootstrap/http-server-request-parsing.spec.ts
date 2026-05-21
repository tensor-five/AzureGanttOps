import { describe, expect, it } from "vitest";

import {
  parseDuplicateWorkItemPayload,
  parseUpdateDetailsPayload,
  parseUpdateStatePayload
} from "./http-server-request-parsing.js";

describe("parseUpdateDetailsPayload", () => {
  it("sanitizes description html", () => {
    const parsed = parseUpdateDetailsPayload({
      targetWorkItemId: 11,
      title: "Item",
      descriptionHtml: '<p onclick="evil()">Alpha</p><script>alert(1)</script>',
      state: "Active"
    });

    expect(parsed).toEqual({
      targetWorkItemId: 11,
      title: "Item",
      descriptionHtml: "<p>Alpha</p>",
      state: "Active"
    });
  });
});

describe("parseUpdateStatePayload", () => {
  it("trims valid state updates", () => {
    expect(parseUpdateStatePayload({ targetWorkItemId: 11, state: " Active " })).toEqual({
      targetWorkItemId: 11,
      state: "Active"
    });
  });

  it("rejects invalid state updates", () => {
    expect(parseUpdateStatePayload({ targetWorkItemId: 0, state: "Active" })).toBeNull();
    expect(parseUpdateStatePayload({ targetWorkItemId: 11, state: " " })).toBeNull();
  });
});

describe("parseDuplicateWorkItemPayload", () => {
  it("accepts a positive source work item id", () => {
    expect(parseDuplicateWorkItemPayload({ sourceWorkItemId: 42 })).toEqual({
      sourceWorkItemId: 42
    });
  });

  it("accepts active schedule field refs for duplicate commands", () => {
    expect(
      parseDuplicateWorkItemPayload({
        sourceWorkItemId: 42,
        scheduleFieldRefs: {
          start: " Custom.StartDate2 ",
          endOrTarget: " Custom.TargetDate2 "
        }
      })
    ).toEqual({
      sourceWorkItemId: 42,
      scheduleFieldRefs: {
        start: "Custom.StartDate2",
        endOrTarget: "Custom.TargetDate2"
      }
    });
  });

  it("rejects missing or invalid source work item ids", () => {
    expect(parseDuplicateWorkItemPayload({ sourceWorkItemId: 0 })).toBeNull();
    expect(parseDuplicateWorkItemPayload({ sourceWorkItemId: "42" })).toBeNull();
    expect(
      parseDuplicateWorkItemPayload({
        sourceWorkItemId: 42,
        scheduleFieldRefs: { start: "", endOrTarget: "Custom.TargetDate2" }
      })
    ).toBeNull();
  });
});
