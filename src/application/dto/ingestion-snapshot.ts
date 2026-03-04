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

export type IngestionWorkItem = {
  id: number;
  title: string;
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
  queryType: "flat";
  workItemIds: number[];
  workItems: IngestionWorkItem[];
  relations: IngestionRelation[];
  hydration: IngestionHydrationMetadata;
};
