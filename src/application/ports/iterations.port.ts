import type { AdoContext } from "./context-settings.port.js";

export type IterationMetadata = {
  id: string;
  name: string;
  path: string;
  startDate: string | null;
  endDate: string | null;
};

export interface IterationsPort {
  listIterations(context?: AdoContext): Promise<IterationMetadata[]>;
}
