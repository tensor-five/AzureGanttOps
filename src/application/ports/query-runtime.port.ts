import type { AdoContext } from "./context-settings.port.js";
import type { IngestionSnapshot } from "../dto/ingestion-snapshot.js";

export type SavedQuery = {
  id: string;
  name: string;
  path: string;
};

export interface QueryRuntimePort {
  listSavedQueries(context?: AdoContext): Promise<SavedQuery[]>;
  executeByQueryId(queryId: string, context?: AdoContext): Promise<IngestionSnapshot>;
}
