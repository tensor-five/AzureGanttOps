import { describe, expect, it } from "vitest";

import { filterDependencyRelations } from "./relation-filter-policy.js";

describe("filterDependencyRelations", () => {
  it("keeps forward and reverse dependency relations", () => {
    const result = filterDependencyRelations([
      {
        rel: "System.LinkTypes.Dependency-Forward",
        source: { id: 11 },
        target: { id: 22 }
      },
      {
        rel: "System.LinkTypes.Dependency-Reverse",
        source: { id: 33 },
        target: { id: 44 }
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
      }
    ]);
  });

  it("filters out non-dependency relation types", () => {
    const result = filterDependencyRelations([
      {
        rel: "System.LinkTypes.Hierarchy-Forward",
        source: { id: 1 },
        target: { id: 2 }
      },
      {
        rel: "System.LinkTypes.Related",
        source: { id: 3 },
        target: { id: 4 }
      }
    ]);

    expect(result).toEqual([]);
  });

  it("ignores invalid endpoints", () => {
    const result = filterDependencyRelations([
      {
        rel: "System.LinkTypes.Dependency-Forward",
        source: { id: "bad" },
        target: { id: 22 }
      },
      {
        rel: "System.LinkTypes.Dependency-Reverse",
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
