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
});
