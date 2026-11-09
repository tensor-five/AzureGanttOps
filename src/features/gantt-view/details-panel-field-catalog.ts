import type { TimelineBar, TimelineReadModel, TimelineUnschedulableItem } from "../../application/dto/timeline-read-model.js";
import type { WorkItemFieldDefinition } from "../../application/dto/work-item-field-definition.js";

export type DetailsFieldKind =
  | "text"
  | "html"
  | "double"
  | "integer"
  | "date"
  | "boolean"
  | "picklist"
  | "identity"
  | "multiline"
  | "tags"
  | "path"
  | "derived"
  | "unknown";

export type DetailsFieldWidth = "half" | "full";

export type DetailsFieldDescriptor = {
  id: string;
  name: string;
  subtitle: string;
  kind: DetailsFieldKind;
  /** Numeric storage type for picklists of integer/double fields. */
  valueType: "string" | "integer" | "double";
  width: DetailsFieldWidth;
  editable: boolean;
  allowedValues: string[];
  /** Work item types that define the field; `null` means every type. */
  workItemTypes: string[] | null;
};

export type DetailsFieldCatalog = {
  fields: DetailsFieldDescriptor[];
  byId: Map<string, DetailsFieldDescriptor>;
  definitionsUnavailable: boolean;
};

export type TimelineDetailsItem = TimelineBar | TimelineUnschedulableItem;

export const DETAILS_FIELD_IDS = {
  title: "System.Title",
  state: "System.State",
  description: "System.Description",
  assignedTo: "System.AssignedTo",
  start: "builtin.start",
  end: "builtin.end",
  id: "System.Id",
  workItemType: "System.WorkItemType",
  dependencies: "builtin.dependencies"
} as const;

export const DEFAULT_DETAILS_PANEL_FIELD_IDS: readonly string[] = [
  DETAILS_FIELD_IDS.title,
  DETAILS_FIELD_IDS.state,
  DETAILS_FIELD_IDS.assignedTo,
  DETAILS_FIELD_IDS.start,
  DETAILS_FIELD_IDS.end,
  "Microsoft.VSTS.Scheduling.StoryPoints",
  DETAILS_FIELD_IDS.dependencies,
  DETAILS_FIELD_IDS.description
];

export const DEFAULT_SCHEDULE_FIELD_REFS = {
  start: "Microsoft.VSTS.Scheduling.StartDate",
  endOrTarget: "Microsoft.VSTS.Scheduling.TargetDate"
} as const;

/**
 * System fields that Azure DevOps never lets a client write. Used when field definitions
 * (with their read-only flag) are unavailable.
 */
export const SYSTEM_READ_ONLY_FIELD_REFS: ReadonlySet<string> = new Set([
  "System.Id",
  "System.Rev",
  "System.WorkItemType",
  "System.CreatedDate",
  "System.CreatedBy",
  "System.ChangedDate",
  "System.ChangedBy",
  "System.AuthorizedDate",
  "System.AuthorizedAs",
  "System.RevisedDate",
  "System.Watermark",
  "System.TeamProject",
  "System.NodeName",
  "System.AreaId",
  "System.IterationId",
  "System.PersonId",
  "System.CommentCount",
  "System.BoardColumn",
  "System.BoardColumnDone",
  "System.BoardLane",
  "System.ExternalLinkCount",
  "System.HyperLinkCount",
  "System.AttachedFileCount",
  "System.RelatedLinkCount",
  "System.RemoteLinkCount",
  "System.Parent"
]);

const HALF_WIDTH_KINDS = new Set<DetailsFieldKind>(["double", "integer", "date", "boolean", "picklist", "identity", "derived"]);

const BUILT_IN_FIELDS: DetailsFieldDescriptor[] = [
  builtIn(DETAILS_FIELD_IDS.title, "Title", "text", true),
  builtIn(DETAILS_FIELD_IDS.state, "State", "picklist", true),
  builtIn(DETAILS_FIELD_IDS.description, "Description", "html", true),
  builtIn(DETAILS_FIELD_IDS.assignedTo, "Assigned To", "identity", true),
  builtIn(DETAILS_FIELD_IDS.start, "Start", "date", true),
  builtIn(DETAILS_FIELD_IDS.end, "End", "date", true),
  builtIn(DETAILS_FIELD_IDS.id, "ID", "derived", false),
  builtIn(DETAILS_FIELD_IDS.workItemType, "Work Item Type", "picklist", false),
  builtIn(DETAILS_FIELD_IDS.dependencies, "Dependencies", "derived", false)
];

export function resolveDetailsFieldWidth(kind: DetailsFieldKind): DetailsFieldWidth {
  return HALF_WIDTH_KINDS.has(kind) ? "half" : "full";
}

/**
 * Maps an Azure DevOps field definition to the kind used by the details panel
 * (see contract section 3 and DPF-17).
 */
export function classifyFieldDefinition(definition: WorkItemFieldDefinition): {
  kind: DetailsFieldKind;
  valueType: DetailsFieldDescriptor["valueType"];
  editable: boolean;
} {
  const type = definition.type.trim().toLowerCase();
  const hasAllowedValues = definition.allowedValues.length > 0;
  const numericType: DetailsFieldDescriptor["valueType"] =
    type === "integer" || type === "picklistinteger" ? "integer" : type === "double" || type === "picklistdouble" ? "double" : "string";

  let kind: DetailsFieldKind;
  if (definition.referenceName === "System.Tags") {
    kind = "tags";
  } else if (definition.isIdentity || type === "identity") {
    kind = "identity";
  } else if (numericType !== "string") {
    kind = hasAllowedValues ? "picklist" : numericType;
  } else if (type === "string" || type === "pickliststring") {
    kind = hasAllowedValues ? "picklist" : "text";
  } else if (type === "html") {
    kind = "html";
  } else if (type === "boolean") {
    kind = "boolean";
  } else if (type === "datetime") {
    kind = "date";
  } else if (type === "plaintext" || type === "history") {
    kind = "multiline";
  } else if (type === "treepath") {
    kind = "path";
  } else {
    kind = "unknown";
  }

  const editable = !definition.readOnly && !SYSTEM_READ_ONLY_FIELD_REFS.has(definition.referenceName);
  return { kind, valueType: numericType, editable };
}

export function buildDetailsFieldCatalog(input: {
  definitions: WorkItemFieldDefinition[] | null;
  timeline: TimelineReadModel | null;
}): DetailsFieldCatalog {
  const scheduleRefs = input.timeline?.scheduleFieldRefs ?? DEFAULT_SCHEDULE_FIELD_REFS;
  const builtInIds = new Set(BUILT_IN_FIELDS.map((field) => field.id));
  const coveredRefs = new Set<string>([...builtInIds, scheduleRefs.start, scheduleRefs.endOrTarget]);
  const fields: DetailsFieldDescriptor[] = BUILT_IN_FIELDS.map((field) => ({ ...field }));

  if (input.definitions) {
    input.definitions.forEach((definition) => {
      if (coveredRefs.has(definition.referenceName)) {
        return;
      }
      coveredRefs.add(definition.referenceName);
      const classified = classifyFieldDefinition(definition);
      fields.push({
        id: definition.referenceName,
        name: definition.name,
        subtitle: definition.referenceName,
        kind: classified.kind,
        valueType: classified.valueType,
        width: resolveDetailsFieldWidth(classified.kind),
        editable: classified.editable,
        allowedValues: [...definition.allowedValues],
        workItemTypes: definition.workItemTypes.length > 0 ? [...definition.workItemTypes] : null
      });
    });
  } else {
    listLoadedFieldRefs(input.timeline).forEach((referenceName) => {
      if (coveredRefs.has(referenceName)) {
        return;
      }
      coveredRefs.add(referenceName);
      fields.push({
        id: referenceName,
        name: referenceName,
        subtitle: referenceName,
        kind: "unknown",
        valueType: "string",
        width: "full",
        editable: !SYSTEM_READ_ONLY_FIELD_REFS.has(referenceName),
        allowedValues: [],
        workItemTypes: null
      });
    });
  }

  return {
    fields,
    byId: new Map(fields.map((field) => [field.id, field])),
    definitionsUnavailable: input.definitions === null
  };
}

/**
 * Pairing rule (contract section 3): a half-width field shares a row only with a directly
 * following visible half-width field; otherwise it spans the full row.
 */
export function layoutDetailsFields<T extends { width: DetailsFieldWidth }>(fields: T[]): Array<{ field: T; width: DetailsFieldWidth }> {
  const result: Array<{ field: T; width: DetailsFieldWidth }> = [];
  for (let index = 0; index < fields.length; index += 1) {
    const current = fields[index];
    const next = fields[index + 1];
    if (current.width === "half" && next?.width === "half") {
      result.push({ field: current, width: "half" }, { field: next, width: "half" });
      index += 1;
      continue;
    }
    result.push({ field: current, width: "full" });
  }
  return result;
}

export function listWorkItemTypes(timeline: TimelineReadModel | null): string[] {
  if (!timeline) {
    return [];
  }

  const types = new Set<string>();
  [...timeline.bars, ...timeline.unschedulable].forEach((item) => {
    const type = item.details.workItemType ?? readString(item.details.fieldValues?.["System.WorkItemType"]);
    if (type) {
      types.add(type);
    }
  });
  return [...types].sort((left, right) => left.localeCompare(right));
}

function listLoadedFieldRefs(timeline: TimelineReadModel | null): string[] {
  if (!timeline) {
    return [];
  }

  const refs = new Set<string>();
  [...timeline.bars, ...timeline.unschedulable].forEach((item) => {
    Object.keys(item.details.fieldValues ?? {}).forEach((ref) => refs.add(ref));
  });
  return [...refs].sort((left, right) => left.localeCompare(right));
}

function builtIn(id: string, name: string, kind: DetailsFieldKind, editable: boolean): DetailsFieldDescriptor {
  return {
    id,
    name,
    subtitle: "Built-in",
    kind,
    valueType: "string",
    width: resolveDetailsFieldWidth(kind),
    editable,
    allowedValues: [],
    workItemTypes: null
  };
}

function readString(value: string | number | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
