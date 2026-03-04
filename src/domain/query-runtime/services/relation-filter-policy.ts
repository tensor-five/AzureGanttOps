import type { IngestionRelation } from "../../../application/dto/ingestion-snapshot.js";

const DEP_FORWARD = "System.LinkTypes.Dependency-Forward";
const DEP_REVERSE = "System.LinkTypes.Dependency-Reverse";

type RawRelation = {
  rel?: unknown;
  source?: unknown;
  target?: unknown;
};

export function filterDependencyRelations(relations: RawRelation[]): IngestionRelation[] {
  const normalized: IngestionRelation[] = [];

  for (const relation of relations) {
    const type = typeof relation.rel === "string" ? relation.rel : "";

    if (type !== DEP_FORWARD && type !== DEP_REVERSE) {
      continue;
    }

    const sourceId = extractId(relation.source);
    const targetId = extractId(relation.target);

    if (sourceId === null || targetId === null) {
      continue;
    }

    normalized.push({
      type,
      sourceId,
      targetId
    });
  }

  return normalized;
}

function extractId(endpoint: unknown): number | null {
  if (!endpoint || typeof endpoint !== "object") {
    return null;
  }

  const id = (endpoint as { id?: unknown }).id;
  return typeof id === "number" ? id : null;
}
