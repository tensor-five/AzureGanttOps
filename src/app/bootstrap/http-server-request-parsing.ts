import type { UserPreferences } from "../../adapters/persistence/settings/lowdb-user-preferences.adapter.js";
import { sanitizeHtmlFragment } from "../../shared/security/sanitize-html-fragment.js";

export function parsePayload(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseUserPreferencesPatch(payload: Record<string, unknown> | null): UserPreferences | null {
  if (!payload) {
    return null;
  }

  const raw = payload.preferences;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  return raw as UserPreferences;
}

export function parseTargetWorkItemIdFromQuery(url: URL): number | null {
  const raw = url.searchParams.get("targetWorkItemId");
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function parseQueryIdFromQuery(url: URL): string | null {
  const raw = url.searchParams.get("queryId");
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseAdoptSchedulePayload(
  input: Record<string, unknown> | null
): { targetWorkItemId: number; startDate: string; endDate: string } | null {
  if (!input) {
    return null;
  }

  const targetWorkItemId = input.targetWorkItemId;
  const startDate = input.startDate;
  const endDate = input.endDate;

  if (
    typeof targetWorkItemId !== "number" ||
    !Number.isFinite(targetWorkItemId) ||
    targetWorkItemId <= 0 ||
    typeof startDate !== "string" ||
    startDate.trim().length === 0 ||
    typeof endDate !== "string" ||
    endDate.trim().length === 0
  ) {
    return null;
  }

  return {
    targetWorkItemId,
    startDate,
    endDate
  };
}

export function parseDependencyLinkPayload(
  input: Record<string, unknown> | null
): { predecessorWorkItemId: number; successorWorkItemId: number; action: "add" | "remove" } | null {
  if (!input) {
    return null;
  }

  const predecessorWorkItemId = input.predecessorWorkItemId;
  const successorWorkItemId = input.successorWorkItemId;
  const action = input.action;

  if (
    typeof predecessorWorkItemId !== "number" ||
    !Number.isFinite(predecessorWorkItemId) ||
    predecessorWorkItemId <= 0 ||
    typeof successorWorkItemId !== "number" ||
    !Number.isFinite(successorWorkItemId) ||
    successorWorkItemId <= 0 ||
    predecessorWorkItemId === successorWorkItemId ||
    (action !== "add" && action !== "remove")
  ) {
    return null;
  }

  return {
    predecessorWorkItemId,
    successorWorkItemId,
    action
  };
}

export function parseReparentPayload(
  input: Record<string, unknown> | null
): { targetWorkItemId: number; newParentId: number | null } | null {
  if (!input) {
    return null;
  }

  const targetWorkItemId = input.targetWorkItemId;
  const newParentId = input.newParentId;

  if (
    typeof targetWorkItemId !== "number" ||
    !Number.isFinite(targetWorkItemId) ||
    targetWorkItemId <= 0
  ) {
    return null;
  }

  if (newParentId === null || newParentId === undefined) {
    return { targetWorkItemId, newParentId: null };
  }

  if (
    typeof newParentId !== "number" ||
    !Number.isFinite(newParentId) ||
    newParentId <= 0 ||
    newParentId === targetWorkItemId
  ) {
    return null;
  }

  return { targetWorkItemId, newParentId };
}

const FIELD_REFERENCE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
const MAX_UPDATE_FIELDS = 100;

export type UpdateDetailsOperation =
  | { op: "add"; path: string; value: string | number | boolean }
  | { op: "remove"; path: string };

/**
 * Parses a details update. Accepts `fields` (reference name -> value, `null` clears the field)
 * and the legacy `title`/`descriptionHtml`/`state` shape. Values of System.Description, of every
 * server-determined HTML field (`options.htmlFieldRefs`) and of every reference the client lists in
 * `htmlFields` are sanitized as HTML fragments; the client list can only add sanitization.
 */
export function parseUpdateDetailsPayload(
  input: Record<string, unknown> | null,
  options: { htmlFieldRefs?: Iterable<string> } = {}
): { targetWorkItemId: number; operations: UpdateDetailsOperation[] } | null {
  if (!input) {
    return null;
  }

  const targetWorkItemId = input.targetWorkItemId;
  if (typeof targetWorkItemId !== "number" || !Number.isInteger(targetWorkItemId) || targetWorkItemId <= 0) {
    return null;
  }

  const fields = resolveUpdateFields(input);
  if (!fields) {
    return null;
  }

  const entries = Object.entries(fields);
  if (entries.length === 0 || entries.length > MAX_UPDATE_FIELDS) {
    return null;
  }

  const htmlFieldRefs = new Set<string>(["System.Description", ...(options.htmlFieldRefs ?? [])]);
  if (Array.isArray(input.htmlFields)) {
    input.htmlFields.forEach((entry) => {
      if (typeof entry === "string") {
        htmlFieldRefs.add(entry);
      }
    });
  }

  const operations: UpdateDetailsOperation[] = [];
  for (const [referenceName, rawValue] of entries) {
    if (!FIELD_REFERENCE_NAME_PATTERN.test(referenceName)) {
      return null;
    }

    const path = `/fields/${referenceName}`;
    if (rawValue === null) {
      if (referenceName === "System.Title" || referenceName === "System.State") {
        return null;
      }
      operations.push({ op: "remove", path });
      continue;
    }

    if (typeof rawValue === "number") {
      if (!Number.isFinite(rawValue)) {
        return null;
      }
      operations.push({ op: "add", path, value: rawValue });
      continue;
    }

    if (typeof rawValue === "boolean") {
      operations.push({ op: "add", path, value: rawValue });
      continue;
    }

    if (typeof rawValue !== "string") {
      return null;
    }

    const value = htmlFieldRefs.has(referenceName) ? sanitizeHtmlFragment(rawValue) : rawValue;
    if ((referenceName === "System.Title" || referenceName === "System.State") && value.trim().length === 0) {
      return null;
    }
    operations.push({
      op: "add",
      path,
      value: referenceName === "System.Title" || referenceName === "System.State" ? value.trim() : value
    });
  }

  return { targetWorkItemId, operations };
}

function resolveUpdateFields(input: Record<string, unknown>): Record<string, unknown> | null {
  const fields = input.fields;
  if (fields !== undefined) {
    return fields && typeof fields === "object" && !Array.isArray(fields) ? (fields as Record<string, unknown>) : null;
  }

  const { title, descriptionHtml, state } = input;
  if (typeof title !== "string" || typeof descriptionHtml !== "string" || typeof state !== "string") {
    return null;
  }

  return {
    "System.Title": title,
    "System.Description": descriptionHtml,
    "System.State": state
  };
}

export function parseUpdateStatePayload(
  input: Record<string, unknown> | null
): { targetWorkItemId: number; state: string } | null {
  if (!input) {
    return null;
  }

  const targetWorkItemId = input.targetWorkItemId;
  const state = input.state;

  if (
    typeof targetWorkItemId !== "number" ||
    !Number.isFinite(targetWorkItemId) ||
    targetWorkItemId <= 0 ||
    typeof state !== "string" ||
    state.trim().length === 0
  ) {
    return null;
  }

  return {
    targetWorkItemId,
    state: state.trim()
  };
}

export function parseUpdateAssignedToPayload(
  input: Record<string, unknown> | null
): { targetWorkItemId: number; assignedTo: string } | null {
  if (!input) {
    return null;
  }

  const targetWorkItemId = input.targetWorkItemId;
  const assignedTo = input.assignedTo;

  if (
    typeof targetWorkItemId !== "number" ||
    !Number.isFinite(targetWorkItemId) ||
    targetWorkItemId <= 0 ||
    typeof assignedTo !== "string" ||
    assignedTo.trim().length === 0
  ) {
    return null;
  }

  return {
    targetWorkItemId,
    assignedTo: assignedTo.trim()
  };
}

export function parseDuplicateWorkItemPayload(
  input: Record<string, unknown> | null
): { sourceWorkItemId: number; scheduleFieldRefs?: { start: string; endOrTarget: string } } | null {
  if (!input) {
    return null;
  }

  const sourceWorkItemId = input.sourceWorkItemId;
  if (
    typeof sourceWorkItemId !== "number" ||
    !Number.isFinite(sourceWorkItemId) ||
    sourceWorkItemId <= 0
  ) {
    return null;
  }

  const scheduleFieldRefs = parseScheduleFieldRefs(input.scheduleFieldRefs);
  if (input.scheduleFieldRefs !== undefined && !scheduleFieldRefs) {
    return null;
  }

  return {
    sourceWorkItemId,
    ...(scheduleFieldRefs ? { scheduleFieldRefs } : {})
  };
}

export function parseChildWorkItemCreatePayload(
  input: Record<string, unknown> | null
): {
  parentWorkItemId: number;
  childWorkItemType: string;
  title?: string;
  scheduleFieldRefs?: {
    start: string;
    endOrTarget: string;
  };
} | null {
  if (!input || Object.prototype.hasOwnProperty.call(input, "childType")) {
    return null;
  }

  const parentWorkItemId = input.parentWorkItemId;
  if (
    typeof parentWorkItemId !== "number" ||
    !Number.isFinite(parentWorkItemId) ||
    parentWorkItemId <= 0
  ) {
    return null;
  }

  const childWorkItemType = input.childWorkItemType;
  if (typeof childWorkItemType !== "string" || childWorkItemType.trim().length === 0) {
    return null;
  }

  const scheduleFieldRefs = parseScheduleFieldRefs(input.scheduleFieldRefs);
  if (input.scheduleFieldRefs !== undefined && !scheduleFieldRefs) {
    return null;
  }

  if (input.title === undefined || input.title === null) {
    return {
      parentWorkItemId,
      childWorkItemType: childWorkItemType.trim(),
      ...(scheduleFieldRefs ? { scheduleFieldRefs } : {})
    };
  }

  if (typeof input.title !== "string") {
    return null;
  }

  const title = input.title.trim();
  return {
    parentWorkItemId,
    childWorkItemType: childWorkItemType.trim(),
    ...(title.length > 0 ? { title } : {}),
    ...(scheduleFieldRefs ? { scheduleFieldRefs } : {})
  };
}

function parseScheduleFieldRefs(input: unknown): { start: string; endOrTarget: string } | null {
  if (input === undefined) {
    return null;
  }
  if (!input || typeof input !== "object") {
    return null;
  }

  const refs = input as Record<string, unknown>;
  const start = refs.start;
  const endOrTarget = refs.endOrTarget;

  if (
    typeof start !== "string" ||
    start.trim().length === 0 ||
    typeof endOrTarget !== "string" ||
    endOrTarget.trim().length === 0
  ) {
    return null;
  }

  return {
    start: start.trim(),
    endOrTarget: endOrTarget.trim()
  };
}

export function parseMappingProfileUpsert(input: unknown):
  | {
      id: string;
      name: string;
      fields: {
        id: string;
        title: string;
        start: string;
        endOrTarget: string;
      };
    }
  | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const candidate = input as {
    id?: unknown;
    name?: unknown;
    fields?: {
      id?: unknown;
      title?: unknown;
      start?: unknown;
      endOrTarget?: unknown;
    };
  };

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    !candidate.fields ||
    typeof candidate.fields.id !== "string" ||
    typeof candidate.fields.title !== "string" ||
    typeof candidate.fields.start !== "string" ||
    typeof candidate.fields.endOrTarget !== "string"
  ) {
    return undefined;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    fields: {
      id: candidate.fields.id,
      title: candidate.fields.title,
      start: candidate.fields.start,
      endOrTarget: candidate.fields.endOrTarget
    }
  };
}

export function parseAzCliPathPayload(input: Record<string, unknown> | null): string | null {
  if (!input || typeof input.path !== "string") {
    return null;
  }

  return input.path.trim();
}

export function parseLocalConfigResetPayload(input: Record<string, unknown> | null): { confirmation: string } | null {
  if (!input || Object.keys(input).length !== 1 || typeof input.confirmation !== "string") {
    return null;
  }

  return {
    confirmation: input.confirmation
  };
}
