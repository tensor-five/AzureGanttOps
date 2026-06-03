import { describe, expect, it } from "vitest";

import {
  parseChildWorkItemCreatePayload,
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

describe("parseChildWorkItemCreatePayload", () => {
  it("accepts a parent work item id, child work item type, and trimmed optional title", () => {
    expect(parseChildWorkItemCreatePayload({ parentWorkItemId: 42, childWorkItemType: " Task " })).toEqual({
      parentWorkItemId: 42,
      childWorkItemType: "Task"
    });
    expect(
      parseChildWorkItemCreatePayload({
        parentWorkItemId: 42,
        childWorkItemType: "User Story",
        title: " New child "
      })
    ).toEqual({
      parentWorkItemId: 42,
      childWorkItemType: "User Story",
      title: "New child"
    });
  });

  it("omits empty optional titles so the backend default title can apply", () => {
    expect(parseChildWorkItemCreatePayload({ parentWorkItemId: 42, childWorkItemType: "Task", title: " " })).toEqual({
      parentWorkItemId: 42,
      childWorkItemType: "Task"
    });
  });

  it("accepts active schedule field refs for child-create commands", () => {
    expect(
      parseChildWorkItemCreatePayload({
        parentWorkItemId: 42,
        childWorkItemType: "Task",
        scheduleFieldRefs: {
          start: " Custom.StartDate2 ",
          endOrTarget: " Custom.TargetDate2 "
        }
      })
    ).toEqual({
      parentWorkItemId: 42,
      childWorkItemType: "Task",
      scheduleFieldRefs: {
        start: "Custom.StartDate2",
        endOrTarget: "Custom.TargetDate2"
      }
    });
  });

  it("rejects invalid ids, invalid child work item types, invalid titles, and legacy client childType", () => {
    expect(parseChildWorkItemCreatePayload({ parentWorkItemId: 0, childWorkItemType: "Task" })).toBeNull();
    expect(parseChildWorkItemCreatePayload({ parentWorkItemId: "42", childWorkItemType: "Task" })).toBeNull();
    expect(parseChildWorkItemCreatePayload({ parentWorkItemId: 42 })).toBeNull();
    expect(parseChildWorkItemCreatePayload({ parentWorkItemId: 42, childWorkItemType: " " })).toBeNull();
    expect(parseChildWorkItemCreatePayload({ parentWorkItemId: 42, childWorkItemType: 123 })).toBeNull();
    expect(parseChildWorkItemCreatePayload({ parentWorkItemId: 42, childWorkItemType: "Task", title: 123 })).toBeNull();
    expect(
      parseChildWorkItemCreatePayload({
        parentWorkItemId: 42,
        childWorkItemType: "Task",
        scheduleFieldRefs: { start: "", endOrTarget: "Custom.TargetDate2" }
      })
    ).toBeNull();
    expect(parseChildWorkItemCreatePayload({ parentWorkItemId: 42, childWorkItemType: "Task", childType: "Bug" })).toBeNull();
  });
});
