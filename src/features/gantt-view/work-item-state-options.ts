import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";

export type WorkItemStateOption = {
  name: string;
  color: string | null;
};

const KNOWN_STATE_ORDER = ["To Do", "New", "Active", "Resolved", "Closed", "Done"];

export function resolveWorkItemStateOptions(input: {
  timeline: TimelineReadModel | null;
  selectedState: string;
  serverStateOptions: WorkItemStateOption[];
}): WorkItemStateOption[] {
  const selectedState = input.selectedState.trim();
  const normalizedServerOptions = normalizeWorkItemStateOptions(input.serverStateOptions);

  if (normalizedServerOptions.length > 0) {
    if (
      selectedState.length > 0 &&
      !normalizedServerOptions.some((entry) => sameStateName(entry.name, selectedState))
    ) {
      return [{ name: selectedState, color: null }, ...normalizedServerOptions];
    }

    return normalizedServerOptions;
  }

  const discovered = discoverTimelineStates(input.timeline);
  if (selectedState.length > 0) {
    discovered.set(selectedState.toLowerCase(), selectedState);
  }

  const result: WorkItemStateOption[] = [];
  for (const state of KNOWN_STATE_ORDER) {
    result.push({ name: state, color: null });
    discovered.delete(state.toLowerCase());
  }

  [...discovered.values()]
    .sort((left, right) => left.localeCompare(right))
    .forEach((state) => {
      result.push({ name: state, color: null });
    });

  return result.length > 0 ? result : [{ name: selectedState || "To Do", color: null }];
}

export function normalizeWorkItemStateOptions(options: WorkItemStateOption[]): WorkItemStateOption[] {
  const seen = new Set<string>();
  const normalized: WorkItemStateOption[] = [];

  for (const option of options) {
    const name = option.name.trim();
    if (name.length === 0) {
      continue;
    }

    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push({ name, color: option.color });
  }

  return normalized;
}

function discoverTimelineStates(timeline: TimelineReadModel | null): Map<string, string> {
  const discovered = new Map<string, string>();

  timeline?.bars.forEach((bar) => {
    const state = bar.state.code.trim();
    if (state.length > 0 && !discovered.has(state.toLowerCase())) {
      discovered.set(state.toLowerCase(), state);
    }
  });

  timeline?.unschedulable.forEach((item) => {
    const state = item.state.code.trim();
    if (state.length > 0 && !discovered.has(state.toLowerCase())) {
      discovered.set(state.toLowerCase(), state);
    }
  });

  return discovered;
}

function sameStateName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}
