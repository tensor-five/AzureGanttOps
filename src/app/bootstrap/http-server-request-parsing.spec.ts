import { describe, expect, it } from "vitest";

import {
  parseChildWorkItemCreatePayload,
  parseDependencyLinkPayload,
  parseDuplicateWorkItemPayload,
  parseUpdateAssignedToPayload,
  parseUpdateDetailsPayload,
  parseUpdateStatePayload
} from "./http-server-request-parsing.js";

describe("parseUpdateDetailsPayload", () => {
  it("maps the legacy payload to sanitized field operations", () => {
    const parsed = parseUpdateDetailsPayload({
      targetWorkItemId: 11,
      title: "Item",
      descriptionHtml: '<p onclick="evil()">Alpha</p><script>alert(1)</script>',
      state: "Active"
    });

    expect(parsed).toEqual({
      targetWorkItemId: 11,
      operations: [
        { op: "add", path: "/fields/System.Title", value: "Item" },
        { op: "add", path: "/fields/System.Description", value: "<p>Alpha</p>" },
        { op: "add", path: "/fields/System.State", value: "Active" }
      ]
    });
  });

  it("builds add and remove operations from generic fields and sanitizes declared html fields", () => {
    expect(
      parseUpdateDetailsPayload({
        targetWorkItemId: 11,
        fields: {
          "Microsoft.VSTS.Scheduling.StoryPoints": 3.5,
          "Microsoft.VSTS.Common.AcceptanceCriteria": "<p>ok</p><script>x()</script>",
          "Custom.Blocked": true,
          "Microsoft.VSTS.Scheduling.RemainingWork": null
        },
        htmlFields: ["Microsoft.VSTS.Common.AcceptanceCriteria"]
      })
    ).toEqual({
      targetWorkItemId: 11,
      operations: [
        { op: "add", path: "/fields/Microsoft.VSTS.Scheduling.StoryPoints", value: 3.5 },
        { op: "add", path: "/fields/Microsoft.VSTS.Common.AcceptanceCriteria", value: "<p>ok</p>" },
        { op: "add", path: "/fields/Custom.Blocked", value: true },
        { op: "remove", path: "/fields/Microsoft.VSTS.Scheduling.RemainingWork" }
      ]
    });
  });

  it.each([
    { targetWorkItemId: 11, fields: { "../System.Title": "x" } },
    { targetWorkItemId: 11, fields: { "System.Title": { nested: true } } },
    { targetWorkItemId: 11, fields: { "System.Title": null } },
    { targetWorkItemId: 11, fields: { "System.State": "  " } },
    { targetWorkItemId: 11, fields: { "Custom.Value": Number.NaN } },
    { targetWorkItemId: 11, fields: {} },
    { targetWorkItemId: 0, fields: { "System.Title": "x" } },
    { targetWorkItemId: 11, fields: ["System.Title"] }
  ])("rejects invalid details payload %#", (payload) => {
    expect(parseUpdateDetailsPayload(payload as Record<string, unknown>)).toBeNull();
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

describe("parseUpdateAssignedToPayload", () => {
  it("trims valid assigned-to updates", () => {
    expect(parseUpdateAssignedToPayload({ targetWorkItemId: 11, assignedTo: " Ada Lovelace " })).toEqual({
      targetWorkItemId: 11,
      assignedTo: "Ada Lovelace"
    });
  });

  it("rejects invalid assigned-to updates", () => {
    expect(parseUpdateAssignedToPayload({ targetWorkItemId: 0, assignedTo: "Ada Lovelace" })).toBeNull();
    expect(parseUpdateAssignedToPayload({ targetWorkItemId: 11, assignedTo: " " })).toBeNull();
  });
});

describe("parseDependencyLinkPayload", () => {
  it("accepts valid dependency link payloads", () => {
    expect(
      parseDependencyLinkPayload({
        predecessorWorkItemId: 10,
        successorWorkItemId: 11,
        action: "add"
      })
    ).toEqual({
      predecessorWorkItemId: 10,
      successorWorkItemId: 11,
      action: "add"
    });
    expect(
      parseDependencyLinkPayload({
        predecessorWorkItemId: 10,
        successorWorkItemId: 11,
        action: "remove"
      })
    ).toEqual({
      predecessorWorkItemId: 10,
      successorWorkItemId: 11,
      action: "remove"
    });
  });

  it("rejects self-links", () => {
    expect(
      parseDependencyLinkPayload({
        predecessorWorkItemId: 10,
        successorWorkItemId: 10,
        action: "add"
      })
    ).toBeNull();
  });

  it("rejects invalid ids and actions", () => {
    expect(
      parseDependencyLinkPayload({
        predecessorWorkItemId: 0,
        successorWorkItemId: 11,
        action: "add"
      })
    ).toBeNull();
    expect(
      parseDependencyLinkPayload({
        predecessorWorkItemId: 10,
        successorWorkItemId: "11",
        action: "add"
      })
    ).toBeNull();
    expect(
      parseDependencyLinkPayload({
        predecessorWorkItemId: 10,
        successorWorkItemId: 11,
        action: "replace"
      })
    ).toBeNull();
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
