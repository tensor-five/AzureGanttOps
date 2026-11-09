import type { WorkItemFieldDefinition } from "../../application/dto/work-item-field-definition.js";

/** Validates the untrusted field-definitions payload returned by the local BFF. */
export function parseWorkItemFieldDefinitions(value: unknown): WorkItemFieldDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const referenceName = typeof record.referenceName === "string" ? record.referenceName.trim() : "";
    if (referenceName.length === 0) {
      return [];
    }

    const name = typeof record.name === "string" && record.name.trim().length > 0 ? record.name.trim() : referenceName;
    return [
      {
        referenceName,
        name,
        type: typeof record.type === "string" ? record.type : "",
        readOnly: record.readOnly === true,
        isIdentity: record.isIdentity === true,
        allowedValues: toStringArray(record.allowedValues),
        workItemTypes: toStringArray(record.workItemTypes)
      }
    ];
  });
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}
