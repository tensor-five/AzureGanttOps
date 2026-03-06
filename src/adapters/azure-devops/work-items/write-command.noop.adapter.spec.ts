import { describe, expect, it } from "vitest";

import { WriteCommandNoopAdapter } from "./write-command.noop.adapter.js";

describe("WriteCommandNoopAdapter", () => {
  it("returns deterministic NO_OP result for work item patch", async () => {
    const adapter = new WriteCommandNoopAdapter();

    const result = await adapter.submit({
      kind: "WORK_ITEM_PATCH",
      workItemId: 123,
      operations: [{ op: "add", path: "/fields/System.Title", value: "Title" }]
    });

    expect(result).toEqual({
      accepted: false,
      mode: "NO_OP",
      commandKind: "WORK_ITEM_PATCH",
      operationCount: 1,
      reasonCode: "WRITE_DISABLED"
    });
  });

  it("returns deterministic NO_OP result for dependency command", async () => {
    const adapter = new WriteCommandNoopAdapter();

    const result = await adapter.submit({
      kind: "DEPENDENCY_LINK",
      sourceId: 1,
      targetId: 2,
      relation: "System.LinkTypes.Dependency-Forward",
      action: "add"
    });

    expect(result).toEqual({
      accepted: false,
      mode: "NO_OP",
      commandKind: "DEPENDENCY_LINK",
      operationCount: 1,
      reasonCode: "WRITE_DISABLED"
    });
  });

  it("does not perform mutation side effects across repeated calls", async () => {
    const adapter = new WriteCommandNoopAdapter();

    const first = await adapter.submit({
      kind: "WORK_ITEM_PATCH",
      workItemId: 5,
      operations: [{ op: "replace", path: "/fields/System.Title", value: "A" }]
    });

    const second = await adapter.submit({
      kind: "WORK_ITEM_PATCH",
      workItemId: 5,
      operations: [{ op: "replace", path: "/fields/System.Title", value: "B" }]
    });

    expect(first).toEqual({
      accepted: false,
      mode: "NO_OP",
      commandKind: "WORK_ITEM_PATCH",
      operationCount: 1,
      reasonCode: "WRITE_DISABLED"
    });
    expect(second).toEqual({
      accepted: false,
      mode: "NO_OP",
      commandKind: "WORK_ITEM_PATCH",
      operationCount: 1,
      reasonCode: "WRITE_DISABLED"
    });
  });

  it("returns deterministic shape with multi-operation patch command", async () => {
    const adapter = new WriteCommandNoopAdapter();

    const result = await adapter.submit({
      kind: "WORK_ITEM_PATCH",
      workItemId: 55,
      operations: [
        { op: "test", path: "/rev", value: 3 },
        { op: "replace", path: "/fields/System.Title", value: "Updated" }
      ]
    });

    expect(result).toEqual({
      accepted: false,
      mode: "NO_OP",
      commandKind: "WORK_ITEM_PATCH",
      operationCount: 2,
      reasonCode: "WRITE_DISABLED"
    });
  });

  it("does not expose adapter internals", () => {
    const adapter = new WriteCommandNoopAdapter() as unknown as Record<string, unknown>;

    expect(Object.getOwnPropertyNames(adapter)).toEqual([]);
    expect(typeof adapter.submit).toBe("function");
  });
});
