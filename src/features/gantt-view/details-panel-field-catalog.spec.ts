import { describe, expect, it } from "vitest";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import type { WorkItemFieldDefinition } from "../../application/dto/work-item-field-definition.js";
import {
  DEFAULT_DETAILS_PANEL_FIELD_IDS,
  buildDetailsFieldCatalog,
  classifyFieldDefinition,
  isFieldDefinedForItem,
  layoutDetailsFields,
  listWorkItemTypes,
  resolveDetailsFieldWidth
} from "./details-panel-field-catalog.js";

function definition(partial: Partial<WorkItemFieldDefinition> & { referenceName: string; type: string }): WorkItemFieldDefinition {
  return {
    name: partial.referenceName,
    readOnly: false,
    isIdentity: false,
    allowedValues: [],
    workItemTypes: ["User Story"],
    ...partial
  };
}

function makeTimeline(): TimelineReadModel {
  return {
    queryType: "flat",
    bars: [
      {
        workItemId: 1,
        title: "Story",
        state: { code: "Active", badge: "A", color: "#000000" },
        schedule: { startDate: null, endDate: null, missingBoundary: null },
        details: {
          mappedId: "1",
          workItemType: "User Story",
          fieldValues: { "Microsoft.VSTS.Common.Priority": 2, "System.WorkItemType": "User Story", "System.AssignedTo": "Ada" }
        }
      }
    ],
    unschedulable: [
      {
        workItemId: 2,
        title: "Bug",
        state: { code: "New", badge: "N", color: "#000000" },
        details: { mappedId: "2", fieldValues: { "System.WorkItemType": "Bug", "Custom.Only": "x" } },
        reason: "missing-both-dates"
      }
    ],
    dependencies: [],
    suppressedDependencies: [],
    treeLayout: null,
    mappingValidation: { status: "valid", issues: [] },
    scheduleFieldRefs: { start: "Custom.Start", endOrTarget: "Custom.End" }
  };
}

describe("classifyFieldDefinition", () => {
  it.each([
    [{ referenceName: "A.Points", type: "double" }, "double", true],
    [{ referenceName: "A.Priority", type: "integer" }, "integer", true],
    [{ referenceName: "A.Priority", type: "integer", allowedValues: ["1", "2"] }, "picklist", true],
    [{ referenceName: "A.Area", type: "string", allowedValues: ["Business"] }, "picklist", true],
    [{ referenceName: "A.Notes", type: "string" }, "text", true],
    [{ referenceName: "A.Notes", type: "string", readOnly: true }, "text", false],
    [{ referenceName: "A.Html", type: "html" }, "html", true],
    [{ referenceName: "A.Flag", type: "boolean" }, "boolean", true],
    [{ referenceName: "A.Date", type: "dateTime" }, "date", false],
    [{ referenceName: "A.Tags", type: "plainText" }, "multiline", false],
    [{ referenceName: "A.Path", type: "treePath" }, "path", false],
    [{ referenceName: "A.Who", type: "string", isIdentity: true }, "identity", false],
    [{ referenceName: "A.Guid", type: "guid" }, "unknown", false]
  ])("classifies %o", (input, kind, editable) => {
    const result = classifyFieldDefinition(definition(input as Partial<WorkItemFieldDefinition> & { referenceName: string; type: string }));
    expect(result.kind).toBe(kind);
    expect(result.editable).toBe(editable);
  });

  it("keeps the numeric storage type of numeric picklists", () => {
    expect(classifyFieldDefinition(definition({ referenceName: "A.P", type: "picklistDouble", allowedValues: ["1.5"] })).valueType).toBe("double");
  });
});

describe("resolveDetailsFieldWidth", () => {
  it("uses half width only for short value kinds", () => {
    expect(resolveDetailsFieldWidth("double")).toBe("half");
    expect(resolveDetailsFieldWidth("identity")).toBe("half");
    expect(resolveDetailsFieldWidth("text")).toBe("full");
    expect(resolveDetailsFieldWidth("unknown")).toBe("full");
  });
});

describe("buildDetailsFieldCatalog", () => {
  it("merges built-ins with definitions and skips duplicates including mapped schedule fields", () => {
    const catalog = buildDetailsFieldCatalog({
      timeline: makeTimeline(),
      definitions: [
        definition({ referenceName: "System.Title", type: "string" }),
        definition({ referenceName: "Custom.Start", type: "dateTime" }),
        definition({ referenceName: "Microsoft.VSTS.Scheduling.StoryPoints", name: "Story Points", type: "double" })
      ]
    });

    expect(catalog.definitionsUnavailable).toBe(false);
    expect(catalog.fields.filter((field) => field.id === "System.Title")).toHaveLength(1);
    expect(catalog.byId.has("Custom.Start")).toBe(false);
    expect(catalog.byId.get("Microsoft.VSTS.Scheduling.StoryPoints")).toMatchObject({ name: "Story Points", width: "half", editable: true });
    DEFAULT_DETAILS_PANEL_FIELD_IDS.forEach((id) => expect(catalog.byId.has(id)).toBe(true));
  });

  it("falls back to loaded read-only fields when definitions are unavailable", () => {
    const catalog = buildDetailsFieldCatalog({ timeline: makeTimeline(), definitions: null });

    expect(catalog.definitionsUnavailable).toBe(true);
    expect(catalog.byId.get("Microsoft.VSTS.Common.Priority")).toMatchObject({ editable: false, width: "full" });
    expect(catalog.byId.get("Custom.Only")).toBeDefined();
    expect(catalog.fields.filter((field) => field.id === "System.AssignedTo")).toHaveLength(1);
    expect(catalog.fields.filter((field) => field.id === "System.WorkItemType")).toHaveLength(1);
  });
});

describe("isFieldDefinedForItem", () => {
  it("hides fields that the item's work item type does not define", () => {
    const timeline = makeTimeline();
    const catalog = buildDetailsFieldCatalog({
      timeline,
      definitions: [definition({ referenceName: "Custom.Points", type: "double", workItemTypes: ["User Story"] })]
    });
    const field = catalog.byId.get("Custom.Points")!;

    expect(isFieldDefinedForItem(field, timeline.bars[0])).toBe(true);
    expect(isFieldDefinedForItem(field, timeline.unschedulable[0])).toBe(false);
    expect(isFieldDefinedForItem(catalog.byId.get("System.Title")!, timeline.unschedulable[0])).toBe(true);
  });
});

describe("layoutDetailsFields", () => {
  it("pairs only directly following half-width fields", () => {
    const fields = [
      { id: "a", width: "full" as const },
      { id: "b", width: "half" as const },
      { id: "c", width: "half" as const },
      { id: "d", width: "half" as const },
      { id: "e", width: "full" as const },
      { id: "f", width: "half" as const }
    ];

    expect(layoutDetailsFields(fields).map((entry) => `${entry.field.id}:${entry.width}`)).toEqual([
      "a:full",
      "b:half",
      "c:half",
      "d:full",
      "e:full",
      "f:full"
    ]);
  });
});

describe("listWorkItemTypes", () => {
  it("collects distinct work item types from all items", () => {
    expect(listWorkItemTypes(makeTimeline())).toEqual(["Bug", "User Story"]);
    expect(listWorkItemTypes(null)).toEqual([]);
  });
});
