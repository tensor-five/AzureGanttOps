import { AzureCliPreflightAdapter } from "../../adapters/azure-devops/auth/azure-cli-preflight.adapter.js";
import { AzureQueryRuntimeAdapter, type HttpClient } from "../../adapters/azure-devops/queries/azure-query-runtime.adapter.js";
import { FileContextSettingsAdapter } from "../../adapters/persistence/settings/file-context-settings.adapter.js";
import { AdoContextStore } from "../config/ado-context.store.js";
import { RunQueryIntakeUseCase } from "../../application/use-cases/run-query-intake.use-case.js";

export type Phase1QueryFlow = {
  runQueryIntake: RunQueryIntakeUseCase;
};

export function createPhase1QueryFlow(params: {
  httpClient: HttpClient;
  contextFilePath: string;
}): Phase1QueryFlow {
  const settingsAdapter = new FileContextSettingsAdapter(params.contextFilePath);
  const contextStore = new AdoContextStore(settingsAdapter);
  const authPreflight = new AzureCliPreflightAdapter();
  const queryRuntime = new AzureQueryRuntimeAdapter(params.httpClient, contextStore);
  const runQueryIntake = new RunQueryIntakeUseCase(authPreflight, queryRuntime);

  return {
    runQueryIntake
  };
}
