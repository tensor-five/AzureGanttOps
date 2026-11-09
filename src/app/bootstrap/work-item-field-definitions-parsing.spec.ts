import { describe, expect, it } from "vitest";

import { parseWorkItemFieldDefinitions } from "./work-item-field-definitions-parsing.js";

describe("parseWorkItemFieldDefinitions", () => {
  it("keeps valid entries and normalizes optional properties", () => {
    expect(
      parseWorkItemFieldDefinitions([
        { referenceName: " A.Points ", name: "Points", type: "double", readOnly: true, allowedValues: ["1", 2], workItemTypes: ["Bug"] },
        { referenceName: "A.Other" },
        { name: "missing ref" },
        null
      ])
    ).toEqual([
      { referenceName: "A.Points", name: "Points", type: "double", readOnly: true, isIdentity: false, allowedValues: ["1"], workItemTypes: ["Bug"] },
      { referenceName: "A.Other", name: "A.Other", type: "", readOnly: false, isIdentity: false, allowedValues: [], workItemTypes: [] }
    ]);
    expect(parseWorkItemFieldDefinitions({})).toEqual([]);
  });
});
