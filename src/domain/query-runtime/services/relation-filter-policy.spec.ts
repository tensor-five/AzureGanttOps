import { describe, expect, it } from "vitest";

import { filterRuntimeRelations } from "./relation-filter-policy.js";

describe("filterRuntimeRelations", () => {
  it("preserves dependency and hierarchy direction semantics", () => {
    const result = filterRuntimeRelations([
      {
        rel: "System.LinkTypes.Dependency-Forward",
        source: { id: 11 },
        target: { id: 22 }
      },
      {
        rel: "System.LinkTypes.Dependency-Reverse",
        source: { id: 33 },
        target: { id: 44 }
      },
      {
        rel: "System.LinkTypes.Hierarchy-Forward",
        source: { id: 55 },
        target: { id: 66 }
      },
      {
        rel: "System.LinkTypes.Hierarchy-Reverse",
        source: { id: 77 },
        target: { id: 88 }
      }
    ]);

    expect(result).toEqual([
      {
        type: "System.LinkTypes.Dependency-Forward",
        sourceId: 11,
        targetId: 22
      },
      {
        type: "System.LinkTypes.Dependency-Reverse",
        sourceId: 33,
        targetId: 44
      },
      {
        type: "System.LinkTypes.Hierarchy-Forward",
        sourceId: 55,
        targetId: 66
      },
      {
        type: "System.LinkTypes.Hierarchy-Reverse",
        sourceId: 77,
        targetId: 88
      }
    ]);
  });

  it("filters unsupported relation types", () => {
    const result = filterRuntimeRelations([
      {
        rel: "System.LinkTypes.Related",
        source: { id: 1 },
        target: { id: 2 }
      },
      {
        rel: "ArtifactLink",
        source: { id: 3 },
        target: { id: 4 }
      }
    ]);

    expect(result).toEqual([]);
  });

  it("ignores invalid endpoints", () => {
    const result = filterRuntimeRelations([
      {
        rel: "System.LinkTypes.Dependency-Forward",
        source: { id: "bad" },
        target: { id: 22 }
      },
      {
        rel: "System.LinkTypes.Hierarchy-Reverse",
        source: { id: 33 }
      },
      {
        rel: "System.LinkTypes.Dependency-Forward",
        source: { id: 55 },
        target: { id: 66 }
      }
    ]);

    expect(result).toEqual([
      {
        type: "System.LinkTypes.Dependency-Forward",
        sourceId: 55,
        targetId: 66
      }
    ]);
  });
});
