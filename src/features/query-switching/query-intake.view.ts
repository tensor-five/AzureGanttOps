import type { IngestionRelation } from "../../application/dto/ingestion-snapshot.js";
import type { SavedQuery } from "../../application/ports/query-runtime.port.js";

export type QueryIntakeViewModel = {
  success: boolean;
  guidance: string | null;
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
  const guidanceLine = model.guidance ? `Action: ${model.guidance}` : "Action: none";
  const selectedLine = model.selectedQueryId ? `Selected query: ${model.selectedQueryId}` : "Selected query: none";
  const queryLines = model.savedQueries.length
    ? model.savedQueries.map((query) => `- ${query.name} (${query.id})`).join("\n")
    : "- none";
  const workItemLines = model.workItemIds.length ? model.workItemIds.map((id) => `- #${id}`).join("\n") : "- none";
  const arrowLines = buildFsArrows(model.relations).map((arrow) => `- ${arrow.label}`).join("\n") || "- none";

  return [
    statusLine,
    guidanceLine,
    selectedLine,
    "Saved queries:",
    queryLines,
    "Work item IDs:",
    workItemLines,
    "Dependencies (FS arrows: predecessor end -> successor start):",
    arrowLines
  ].join("\n");
}

export function buildFsArrows(relations: IngestionRelation[]): FsArrow[] {
  return relations.map((relation) => {
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
