export type IngestionQueryType = "flat" | "tree" | "oneHop";

export type IngestionRelationType =
  | "System.LinkTypes.Dependency-Forward"
  | "System.LinkTypes.Dependency-Reverse"
  | "System.LinkTypes.Hierarchy-Forward"
  | "System.LinkTypes.Hierarchy-Reverse";

export type IngestionRelation = {
  type: IngestionRelationType;
  sourceId: number;
  targetId: number;
};

export type IngestionQueryRelation = {
  sourceWorkItemId: number | null;
  targetWorkItemId: number;
  relationType: string;
};

export type IngestionWorkItem = {
  id: number;
  title: string;
  [fieldRef: string]: string | number | null | undefined;
};

export type IngestionHydrationStatus = "OK" | "HYDRATION_PARTIAL_FAILURE";

export type IngestionHydrationMetadata = {
  maxIdsPerBatch: number;
  requestedIds: number;
  attemptedBatches: number;
  succeededBatches: number;
  retriedRequests: number;
  missingIds: number[];
  partial: boolean;
  statusCode: IngestionHydrationStatus;
};

export type IngestionSnapshot = {
  queryType: IngestionQueryType;
  workItemIds: number[];
  workItems: IngestionWorkItem[];
  relations: IngestionRelation[];
  queryRelations: IngestionQueryRelation[];
  hydration: IngestionHydrationMetadata;
};
