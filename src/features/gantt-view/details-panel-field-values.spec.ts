import { describe, expect, it } from "vitest";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import { buildDetailsFieldCatalog, type DetailsFieldDescriptor } from "./details-panel-field-catalog.js";
import {
  DOUBLE_VALIDATION_MESSAGE,
  INTEGER_VALIDATION_MESSAGE,
  formatDateTime,
  readDetailsFieldValue,
  toDetailsFieldSaveValue,
  validateDetailsFieldDraft
} from "./details-panel-field-values.js";

function makeTimeline(): TimelineReadModel {
  return {
    queryType: "flat",
    bars: [
      {
        workItemId: 7,
        title: "Item",
        state: { code: "Active", badge: "A", color: "#000000" },
        schedule: { startDate: "2026-03-02T08:00:00.000Z", endDate: null, missingBoundary: "end" },
        details: {
          mappedId: "7",
          workItemType: "Bug",
          assignedTo: "Ada",
          descriptionHtml: "<p onclick=\"x()\">Desc</p>",
          fieldValues: { "Custom.Flag": "True", "Custom.Points": 3, "Custom.Html": "<b>x</b>" }
        }
      }
    ],
    unschedulable: [],
    dependencies: [{ predecessorWorkItemId: 6, successorWorkItemId: 7, dependencyType: "FS", label: "" }],
    suppressedDependencies: [],
    treeLayout: null,
    mappingValidation: { status: "valid", issues: [] }
  };
}

function field(kind: DetailsFieldDescriptor["kind"], id = "Custom.Value", valueType: DetailsFieldDescriptor["valueType"] = "string"): DetailsFieldDescriptor {
  return { id, name: id, subtitle: id, kind, valueType, width: "full", editable: true, allowedValues: [], workItemTypes: null };
}

describe("readDetailsFieldValue", () => {
  it("reads built-in and generic values", () => {
    const timeline = makeTimeline();
    const item = timeline.bars[0];
    const catalog = buildDetailsFieldCatalog({ timeline, definitions: [] });
    const read = (id: string) => readDetailsFieldValue(catalog.byId.get(id)!, item, timeline);

    expect(read("System.Title")).toBe("Item");
    expect(read("System.State")).toBe("Active");
    expect(read("System.AssignedTo")).toBe("Ada");
    expect(read("System.Description")).toBe("<p>Desc</p>");
    expect(read("System.Id")).toBe("7");
    expect(read("System.WorkItemType")).toBe("Bug");
    expect(read("builtin.dependencies")).toBe("1 pred · 0 succ");
    expect(read("builtin.start")).toBe(formatDateTime("2026-03-02T08:00:00.000Z"));
    expect(read("builtin.end")).toBe("");
    expect(readDetailsFieldValue(field("boolean", "Custom.Flag"), item, timeline)).toBe("Yes");
    expect(readDetailsFieldValue(field("double", "Custom.Points"), item, timeline)).toBe("3");
    expect(readDetailsFieldValue(field("text", "Custom.Missing"), item, timeline)).toBe("");
  });
});

describe("validateDetailsFieldDraft", () => {
  it.each([
    ["double", "3,5", null],
    ["double", "1.25", null],
    ["double", "1.234", DOUBLE_VALIDATION_MESSAGE],
    ["double", "-1", DOUBLE_VALIDATION_MESSAGE],
    ["double", "", null],
    ["integer", "3", null],
    ["integer", "2.5", INTEGER_VALIDATION_MESSAGE],
    ["integer", "-1", INTEGER_VALIDATION_MESSAGE],
    ["text", "anything", null]
  ])("%s %s", (kind, draft, expected) => {
    expect(validateDetailsFieldDraft(field(kind as DetailsFieldDescriptor["kind"]), draft as string)).toBe(expected);
  });
});

describe("toDetailsFieldSaveValue", () => {
  it("converts drafts into tracking-system values", () => {
    expect(toDetailsFieldSaveValue(field("double"), "3,5")).toBe(3.5);
    expect(toDetailsFieldSaveValue(field("integer"), "4")).toBe(4);
    expect(toDetailsFieldSaveValue(field("double"), "")).toBeNull();
    expect(toDetailsFieldSaveValue(field("picklist", "Custom.P", "integer"), "2")).toBe(2);
    expect(toDetailsFieldSaveValue(field("picklist"), "Business")).toBe("Business");
    expect(toDetailsFieldSaveValue(field("boolean"), "Yes")).toBe(true);
    expect(toDetailsFieldSaveValue(field("boolean"), "No")).toBe(false);
    expect(toDetailsFieldSaveValue(field("identity"), "Unassigned")).toBeNull();
    expect(toDetailsFieldSaveValue(field("identity"), "Ada")).toBe("Ada");
    expect(toDetailsFieldSaveValue(field("html"), "<p>ok</p><script>x()</script>")).toBe("<p>ok</p>");
    expect(toDetailsFieldSaveValue(field("html"), "")).toBeNull();
    expect(toDetailsFieldSaveValue(field("html", "System.Description"), "")).toBe("");
    expect(toDetailsFieldSaveValue(field("text", "System.Title"), "  Title  ")).toBe("Title");
  });
});
