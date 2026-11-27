import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import { sanitizeHtmlFragment } from "../../shared/security/sanitize-html-fragment.js";
import {
  DETAILS_FIELD_IDS,
  type DetailsFieldDescriptor,
  type TimelineDetailsItem
} from "./details-panel-field-catalog.js";

export type DetailsFieldSaveValue = string | number | boolean | null;

export const DOUBLE_VALIDATION_MESSAGE = "Enter a number ≥ 0 with up to 2 decimals.";
export const INTEGER_VALIDATION_MESSAGE = "Enter a whole number ≥ 0.";
export const UNASSIGNED_OPTION = "Unassigned";
export const BOOLEAN_OPTIONS = ["Yes", "No"] as const;

/**
 * Raw value of a field for the given item, as text. Empty string means "no value".
 * Editable fields use this as the draft baseline.
 */
export function readDetailsFieldValue(
  field: DetailsFieldDescriptor,
  item: TimelineDetailsItem,
  timeline: TimelineReadModel | null
): string {
  switch (field.id) {
    case DETAILS_FIELD_IDS.title:
      return item.title;
    case DETAILS_FIELD_IDS.state:
      return item.state.code;
    case DETAILS_FIELD_IDS.description:
      return sanitizeHtmlFragment(item.details.descriptionHtml ?? "");
    case DETAILS_FIELD_IDS.assignedTo:
      return item.details.assignedTo ?? toText(item.details.fieldValues?.[DETAILS_FIELD_IDS.assignedTo]);
    case DETAILS_FIELD_IDS.start:
      return formatDateField(field, item.schedule?.startDate ?? null);
    case DETAILS_FIELD_IDS.end:
      return formatDateField(field, item.schedule?.endDate ?? null);
    case DETAILS_FIELD_IDS.id:
      return String(item.workItemId);
    case DETAILS_FIELD_IDS.workItemType:
      return item.details.workItemType ?? toText(item.details.fieldValues?.[DETAILS_FIELD_IDS.workItemType]);
    case DETAILS_FIELD_IDS.dependencies:
      return formatDependencies(item.workItemId, timeline);
    default:
      break;
  }

  const raw = item.details.fieldValues?.[field.id];
  if (field.kind === "boolean") {
    return toBooleanOption(raw);
  }
  if (field.kind === "date") {
    return formatDateField(field, typeof raw === "string" ? raw : null);
  }
  if (field.kind === "html") {
    return sanitizeHtmlFragment(toText(raw));
  }
  return toText(raw);
}

export function validateDetailsFieldDraft(field: DetailsFieldDescriptor, draft: string): string | null {
  const normalized = draft.trim().replace(",", ".");
  if (normalized.length === 0) {
    return null;
  }
  if (field.kind === "double") {
    return /^\d+(\.\d{1,2})?$/.test(normalized) ? null : DOUBLE_VALIDATION_MESSAGE;
  }
  if (field.kind === "integer") {
    return /^\d+$/.test(normalized) ? null : INTEGER_VALIDATION_MESSAGE;
  }
  return null;
}

/** Converts a validated draft into the value sent to the tracking system. */
export function toDetailsFieldSaveValue(field: DetailsFieldDescriptor, draft: string): DetailsFieldSaveValue {
  const trimmed = draft.trim();
  if (field.kind === "html") {
    const sanitized = sanitizeHtmlFragment(draft);
    return sanitized.trim().length > 0 || field.id === DETAILS_FIELD_IDS.description ? sanitized : null;
  }
  if (field.kind === "identity") {
    return trimmed.length === 0 || trimmed === UNASSIGNED_OPTION ? null : trimmed;
  }
  if (field.kind === "boolean") {
    return trimmed.length === 0 ? null : trimmed === "Yes";
  }
  if (field.kind === "date") {
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
  }
  if (trimmed.length === 0) {
    return null;
  }
  if (field.kind === "double" || field.kind === "integer" || field.valueType !== "string") {
    const numeric = Number(trimmed.replace(",", "."));
    return Number.isFinite(numeric) ? numeric : trimmed;
  }
  return field.id === DETAILS_FIELD_IDS.title ? trimmed : draft;
}

/** Editable dates use the `datetime-local` input format in local time; read-only dates the display format. */
function formatDateField(field: DetailsFieldDescriptor, raw: string | null): string {
  return field.editable ? toLocalDateTimeInputValue(raw) : formatDateTime(raw);
}

export function toLocalDateTimeInputValue(raw: string | null): string {
  if (!raw) {
    return "";
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

export function formatDateTime(raw: string | null): string {
  if (!raw) {
    return "";
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(parsed.getDate())}.${pad(parsed.getMonth() + 1)}.${parsed.getFullYear()} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function formatDependencies(workItemId: number, timeline: TimelineReadModel | null): string {
  if (!timeline) {
    return "";
  }

  const predecessors = timeline.dependencies.filter((dependency) => dependency.successorWorkItemId === workItemId).length;
  const successors = timeline.dependencies.filter((dependency) => dependency.predecessorWorkItemId === workItemId).length;
  return `${predecessors} pred · ${successors} succ`;
}

function toBooleanOption(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") {
    return "";
  }
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" ? "Yes" : "No";
}

function toText(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}
