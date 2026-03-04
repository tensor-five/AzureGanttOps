import type { QueryId } from "../value-objects/query-id.js";

export type QueryContext = {
  organization: string;
  project: string;
  queryId: QueryId;
};
