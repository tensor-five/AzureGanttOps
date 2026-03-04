import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import type { SavedQuery } from "../../application/ports/query-runtime.port.js";
import type { MappingValidationIssue } from "../../domain/mapping/mapping-errors.js";

export type QueryIntakeViewModel = {
  success: boolean;
  guidance: string | null;
  flatQuerySupportNote: string;
  activeQueryId: string | null;
  lastRefreshAt: string | null;
  reloadSource: "full_reload" | "preflight_blocked" | "stale_discarded" | null;
  trustState: "ready" | "needs_attention" | "partial_failure";
  savedQueries: SavedQuery[];
  selectedQueryId: string | null;
  timeline: TimelineReadModel | null;
  mappingValidation: {
    status: "valid" | "invalid";
    issues: MappingValidationIssue[];
  };
  showDependencies: boolean;
};

const MAX_PRIMARY_TITLE_LENGTH = 42;

export function renderQueryIntakeView(model: QueryIntakeViewModel): string {
  const statusLine = model.success ? "[OK] Ready" : "[ ] Needs attention";
  const trustLine = `Trust state: ${model.trustState}`;
  const guidanceLine = model.guidance ? `Action: ${model.guidance}` : "Action: none";
  const selectedLine = model.selectedQueryId ? `Selected query: ${model.selectedQueryId}` : "Selected query: none";
  const activeSourceLine = model.activeQueryId ? `Active query source: ${model.activeQueryId}` : "Active query source: none";
  const refreshLine = model.lastRefreshAt ? `Last refresh: ${model.lastRefreshAt}` : "Last refresh: none";
  const reloadLine = model.reloadSource ? `Reload source: ${model.reloadSource}` : "Reload source: none";
  const queryLines = model.savedQueries.length
    ? model.savedQueries.map((query) => `- ${query.name} (${query.id})`).join("\n")
    : "- none";

  const mappingLines = renderMappingValidation(model.mappingValidation);
  const timelineLines = renderTimeline(model.timeline, model.showDependencies);

  return [
    statusLine,
    trustLine,
    model.flatQuerySupportNote,
    guidanceLine,
    selectedLine,
    activeSourceLine,
    refreshLine,
    reloadLine,
    "Saved queries:",
    queryLines,
    "Mapping validation:",
    ...mappingLines,
    ...timelineLines
  ].join("\n");
}

function renderMappingValidation(validation: QueryIntakeViewModel["mappingValidation"]): string[] {
  if (validation.status === "valid") {
    return ["- status: valid", "- issues: none"];
  }

  return [
    "- status: invalid",
    ...validation.issues.map(
      (issue) => `- ${issue.field} [${issue.code}] ${issue.message} | ${issue.guidance}`
    )
  ];
}

function renderTimeline(timeline: TimelineReadModel | null, showDependencies: boolean): string[] {
  if (!timeline) {
    return [
      "Timeline:",
      "- unavailable"
    ];
  }

  const bars = timeline.bars.length
    ? timeline.bars.map((bar) => {
        const title = truncateTitle(bar.title);
        const halfOpenMarker = bar.schedule.missingBoundary ? ` [half-open:${bar.schedule.missingBoundary}]` : "";

        return `- ${title} [${bar.state.badge}|${bar.state.color}]${halfOpenMarker}`;
      })
    : ["- none"];

  const barDetails = timeline.bars.length
    ? timeline.bars.map((bar) => `- #${bar.workItemId} mappedId=${bar.details.mappedId}`)
    : ["- none"];

  const unschedulable = timeline.unschedulable.length
    ? timeline.unschedulable.map((item) => {
        const title = truncateTitle(item.title);
        return `- ${title} [${item.state.badge}|${item.state.color}]`;
      })
    : ["- none"];

  const unschedulableDetails = timeline.unschedulable.length
    ? timeline.unschedulable.map((item) => `- #${item.workItemId} mappedId=${item.details.mappedId}`)
    : ["- none"];

  const dependencyToggle = `Dependency arrows: ${showDependencies ? "shown" : "hidden"}`;
  const dependencyLines = showDependencies
    ? timeline.dependencies.length
      ? timeline.dependencies.map((arrow) => `- ${arrow.label}`)
      : ["- none"]
    : ["- hidden by toggle"];

  const suppressedDependencies = timeline.suppressedDependencies.length
    ? timeline.suppressedDependencies.map(
        (dependency) =>
          `- #${dependency.predecessorWorkItemId} -> #${dependency.successorWorkItemId} (${dependency.reason})`
      )
    : ["- none"];

  return [
    "Timeline bars (title + state):",
    ...bars,
    "Timeline details (mapped ID):",
    ...barDetails,
    "Unschedulable items (title + state):",
    ...unschedulable,
    "Unschedulable details (mapped ID):",
    ...unschedulableDetails,
    dependencyToggle,
    "Dependencies (FS arrows: predecessor end -> successor start):",
    ...dependencyLines,
    "Suppressed dependencies (details only):",
    ...suppressedDependencies
  ];
}

function truncateTitle(title: string): string {
  if (title.length <= MAX_PRIMARY_TITLE_LENGTH) {
    return title;
  }

  return `${title.slice(0, MAX_PRIMARY_TITLE_LENGTH - 1)}…`;
}
