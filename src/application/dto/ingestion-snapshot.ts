export type IngestionRelationType =
  | "System.LinkTypes.Dependency-Forward"
  | "System.LinkTypes.Dependency-Reverse";

export type IngestionRelation = {
  type: IngestionRelationType;
  sourceId: number;
  targetId: number;
};

export type IngestionSnapshot = {
  workItemIds: number[];
  relations: IngestionRelation[];
};
