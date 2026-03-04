import path from "node:path";

import { AzureCliPreflightAdapter } from "../../adapters/azure-devops/auth/azure-cli-preflight.adapter.js";
import { AzureQueryRuntimeAdapter, type HttpClient } from "../../adapters/azure-devops/queries/azure-query-runtime.adapter.js";
import { FileContextSettingsAdapter } from "../../adapters/persistence/settings/file-context-settings.adapter.js";
import { FileMappingSettingsAdapter } from "../../adapters/persistence/settings/file-mapping-settings.adapter.js";
import { AdoContextStore } from "../config/ado-context.store.js";
import { RunQueryIntakeUseCase } from "../../application/use-cases/run-query-intake.use-case.js";
import { BuildTimelineViewUseCase } from "../../application/use-cases/build-timeline-view.use-case.js";

export type Phase1QueryFlow = {
  runQueryIntake: RunQueryIntakeUseCase;
};

export function createPhase1QueryFlow(params: {
  httpClient: HttpClient;
  contextFilePath: string;
  mappingFilePath?: string;
}): Phase1QueryFlow {
  const settingsAdapter = new FileContextSettingsAdapter(params.contextFilePath);
  const contextStore = new AdoContextStore(settingsAdapter);
  const authPreflight = new AzureCliPreflightAdapter();
  const queryRuntime = new AzureQueryRuntimeAdapter(params.httpClient, contextStore);
  const buildTimelineView = new BuildTimelineViewUseCase();
  const mappingSettings = new FileMappingSettingsAdapter(
    params.mappingFilePath ?? path.join(path.dirname(params.contextFilePath), "mapping-settings.json")
  );

  const runQueryIntake = new RunQueryIntakeUseCase(
    authPreflight,
    queryRuntime,
    buildTimelineView,
    mappingSettings
  );

  return {
    runQueryIntake
  };
}
