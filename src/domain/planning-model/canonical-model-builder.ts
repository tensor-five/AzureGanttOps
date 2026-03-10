import type { IngestionSnapshot } from "../../application/dto/ingestion-snapshot.js";
import type { RequiredFieldMappings } from "../mapping/field-mapping.js";
import type { CanonicalDependency } from "./canonical-dependency.js";
import type { CanonicalTask, CanonicalTaskState } from "./canonical-task.js";

export type CanonicalModel = {
  tasks: CanonicalTask[];
  dependencies: CanonicalDependency[];
};

export function buildCanonicalModel(
  snapshot: IngestionSnapshot,
  mappings: RequiredFieldMappings
): CanonicalModel {
  const tasks = buildTasks(snapshot, mappings);
  const dependencies = buildDependencies(snapshot);

  return {
    tasks,
    dependencies
  };
}

function buildTasks(snapshot: IngestionSnapshot, mappings: RequiredFieldMappings): CanonicalTask[] {
  const byId = new Map<number, IngestionSnapshot["workItems"][number]>();
  const parentByChildWorkItemId = buildParentByChildMap(snapshot.relations);

  snapshot.workItems.forEach((item) => {
    byId.set(item.id, item);
  });

  return snapshot.workItemIds
    .map((workItemId) => {
      const item = byId.get(workItemId);
      if (!item) {
        return null;
      }

      const record = item as unknown as Record<string, unknown>;
      const mappedId = readValue(record, mappings.id) ?? String(item.id);
      const title = readValue(record, mappings.title) ?? item.title;

      return {
        workItemId: item.id,
        mappedId,
        title,
        descriptionHtml: readValue(record, "System.Description"),
        workItemType: readValue(record, "System.WorkItemType"),
        fieldValues: readPrimitiveFieldValues(record),
        assignedTo: readAssignedTo(record),
        parentWorkItemId: parentByChildWorkItemId.get(item.id) ?? null,
        startDate: toIsoDate(readValue(record, mappings.start)),
        endDate: toIsoDate(readValue(record, mappings.endOrTarget)),
        state: toState(record)
      } satisfies CanonicalTask;
    })
    .filter((task): task is CanonicalTask => task !== null);
}

function buildDependencies(snapshot: IngestionSnapshot): CanonicalDependency[] {
  const dependencies: CanonicalDependency[] = [];

  snapshot.relations.forEach((relation) => {
    if (relation.type === "System.LinkTypes.Dependency-Forward") {
      dependencies.push({
        predecessorWorkItemId: relation.sourceId,
        successorWorkItemId: relation.targetId,
        relationType: "System.LinkTypes.Dependency-Forward",
        dependencyType: "FS"
      });
      return;
    }

    if (relation.type === "System.LinkTypes.Dependency-Reverse") {
      dependencies.push({
        predecessorWorkItemId: relation.targetId,
        successorWorkItemId: relation.sourceId,
        relationType: "System.LinkTypes.Dependency-Reverse",
        dependencyType: "FS"
      });
    }
  });

  return dependencies;
}

function readValue(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function toIsoDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function readAssignedTo(record: Record<string, unknown>): string | null {
  const direct = readValue(record, "System.AssignedTo");
  if (!direct) {
    return null;
  }

  const formatted = direct.split("<")[0]?.trim() ?? direct.trim();
  return formatted.length > 0 ? formatted : null;
}

function buildParentByChildMap(
  relations: IngestionSnapshot["relations"]
): Map<number, number> {
  const map = new Map<number, number>();

  relations.forEach((relation) => {
    if (relation.type === "System.LinkTypes.Hierarchy-Forward") {
      if (!map.has(relation.targetId)) {
        map.set(relation.targetId, relation.sourceId);
      }
      return;
    }

    if (relation.type === "System.LinkTypes.Hierarchy-Reverse" && !map.has(relation.sourceId)) {
      map.set(relation.sourceId, relation.targetId);
    }
  });

  return map;
}

function readPrimitiveFieldValues(record: Record<string, unknown>): Record<string, string | number | null> {
  const values: Record<string, string | number | null> = {};

  Object.entries(record).forEach(([fieldRef, value]) => {
    if (fieldRef === "id" || fieldRef === "title") {
      return;
    }

    if (typeof value === "string" || typeof value === "number" || value === null) {
      values[fieldRef] = value;
    }
  });

  return values;
}

function toState(record: Record<string, unknown>): CanonicalTaskState {
  const code = readValue(record, "System.State") ?? "Unknown";

  return {
    code,
    badge: toBadge(code),
    color: stateColor(code)
  };
}

function toBadge(code: string): string {
  const firstLetter = code.trim().charAt(0).toUpperCase();
  return firstLetter.length > 0 ? firstLetter : "?";
}

function stateColor(code: string): string {
  switch (code.toLowerCase()) {
    case "new":
      return "#7c3aed";
    case "active":
      return "#1d4ed8";
    case "resolved":
      return "#15803d";
    case "closed":
      return "#6b7280";
    default:
      return "#334155";
  }
}
