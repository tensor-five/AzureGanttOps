import type { IngestionRelation } from "../../application/dto/ingestion-snapshot.js";
import type { SavedQuery } from "../../application/ports/query-runtime.port.js";

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
  workItemIds: number[];
  relations: IngestionRelation[];
};

export type FsArrow = {
  predecessorId: number;
  successorId: number;
  label: string;
};

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
  const workItemLines = model.workItemIds.length ? model.workItemIds.map((id) => `- #${id}`).join("\n") : "- none";
  const arrowLines = buildFsArrows(model.relations).map((arrow) => `- ${arrow.label}`).join("\n") || "- none";

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
    "Work item IDs:",
    workItemLines,
    "Dependencies (FS arrows: predecessor end -> successor start):",
    arrowLines
  ].join("\n");
}

export function buildFsArrows(relations: IngestionRelation[]): FsArrow[] {
  return relations
    .filter(
      (relation) =>
        relation.type === "System.LinkTypes.Dependency-Forward" ||
        relation.type === "System.LinkTypes.Dependency-Reverse"
    )
    .map((relation) => {
      const predecessorId =
        relation.type === "System.LinkTypes.Dependency-Forward" ? relation.sourceId : relation.targetId;
      const successorId =
        relation.type === "System.LinkTypes.Dependency-Forward" ? relation.targetId : relation.sourceId;

      return {
        predecessorId,
        successorId,
        label: `#${predecessorId} [end] -> #${successorId} [start]`
      };
    });
}
