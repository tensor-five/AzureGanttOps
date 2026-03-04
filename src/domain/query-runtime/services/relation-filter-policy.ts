import type { IngestionRelation } from "../../../application/dto/ingestion-snapshot.js";

const DEP_FORWARD = "System.LinkTypes.Dependency-Forward";
const DEP_REVERSE = "System.LinkTypes.Dependency-Reverse";
const HIERARCHY_FORWARD = "System.LinkTypes.Hierarchy-Forward";
const HIERARCHY_REVERSE = "System.LinkTypes.Hierarchy-Reverse";

const SUPPORTED_RELATIONS = new Set([DEP_FORWARD, DEP_REVERSE, HIERARCHY_FORWARD, HIERARCHY_REVERSE]);

type RawRelation = {
  rel?: unknown;
  source?: unknown;
  target?: unknown;
};

export function filterRuntimeRelations(relations: RawRelation[]): IngestionRelation[] {
  const normalized: IngestionRelation[] = [];

  for (const relation of relations) {
    const type = typeof relation.rel === "string" ? relation.rel : "";

    if (!SUPPORTED_RELATIONS.has(type)) {
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
