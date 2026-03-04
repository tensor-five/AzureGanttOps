import { describe, expect, it } from "vitest";

import { buildFsArrows, renderQueryIntakeView } from "./query-intake.view.js";

describe("query-intake view", () => {
  it("renders minimal success indicator and FS dependency direction", () => {
    const view = renderQueryIntakeView({
      success: true,
      guidance: null,
      selectedQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
      savedQueries: [
        {
          id: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
          name: "Delivery Timeline",
          path: "Shared Queries/Delivery Timeline"
        }
      ],
      workItemIds: [101, 202],
      relations: [
        {
          type: "System.LinkTypes.Dependency-Forward",
          sourceId: 101,
          targetId: 202
        }
      ]
    });

    expect(view).toContain("[OK] Ready");
    expect(view).toContain("#101 [end] -> #202 [start]");
    expect(view).toContain("Work item IDs:");
  });

  it("normalizes reverse relation into FS predecessor to successor arrow", () => {
    const arrows = buildFsArrows([
      {
        type: "System.LinkTypes.Dependency-Reverse",
        sourceId: 202,
        targetId: 101
      }
    ]);

    expect(arrows).toEqual([
      {
        predecessorId: 101,
        successorId: 202,
        label: "#101 [end] -> #202 [start]"
      }
    ]);
  });
});
