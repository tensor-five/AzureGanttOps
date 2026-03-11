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

export function parseUpdateDetailsPayload(
  input: Record<string, unknown> | null
): { targetWorkItemId: number; title: string; descriptionHtml: string; state: string } | null {
  if (!input) {
    return null;
  }

  const targetWorkItemId = input.targetWorkItemId;
  const title = input.title;
  const descriptionHtml = input.descriptionHtml;
  const state = input.state;

  if (
    typeof targetWorkItemId !== "number" ||
    !Number.isFinite(targetWorkItemId) ||
    typeof title !== "string" ||
    title.trim().length === 0 ||
    typeof descriptionHtml !== "string" ||
    typeof state !== "string" ||
    state.trim().length === 0
  ) {
    return null;
  }

  return {
    targetWorkItemId,
    title: title.trim(),
    descriptionHtml: sanitizeHtmlFragment(descriptionHtml),
    state: state.trim()
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
