import path from "node:path";

import { AzureCliPreflightAdapter } from "../../adapters/azure-devops/auth/azure-cli-preflight.adapter.js";
import type { CliCommandRunner } from "../../adapters/azure-devops/auth/azure-cli-preflight.adapter.js";
import { AzureQueryRuntimeAdapter, type HttpClient } from "../../adapters/azure-devops/queries/azure-query-runtime.adapter.js";
import { AzureIterationsAdapter } from "../../adapters/azure-devops/iterations/azure-iterations.adapter.js";
import { FileContextSettingsAdapter } from "../../adapters/persistence/settings/file-context-settings.adapter.js";
import { FileMappingSettingsAdapter } from "../../adapters/persistence/settings/file-mapping-settings.adapter.js";
import { AdoContextStore } from "../config/ado-context.store.js";
import { resolveCapabilityFlags, type CapabilityFlags } from "../config/capability-flags.js";
import { RunQueryIntakeUseCase } from "../../application/use-cases/run-query-intake.use-case.js";
import { BuildTimelineViewUseCase } from "../../application/use-cases/build-timeline-view.use-case.js";
import { SubmitWriteCommandUseCase } from "../../application/use-cases/submit-write-command.use-case.js";
import { WriteCommandNoopAdapter } from "../../adapters/azure-devops/work-items/write-command.noop.adapter.js";
import { WriteCommandAzureAdapter } from "../../adapters/azure-devops/work-items/write-command.azure.adapter.js";

export type Phase1QueryFlow = {
  runQueryIntake: RunQueryIntakeUseCase;
  submitWriteCommand: SubmitWriteCommandUseCase;
  capabilities: CapabilityFlags;
};

export function createPhase1QueryFlow(params: {
  httpClient: HttpClient & {
    patch?: (url: string, body: unknown, headers?: Record<string, string>) => Promise<{
      status: number;
      json: unknown;
      headers?: Record<string, string | undefined>;
    }>;
  };
  contextFilePath: string;
  mappingFilePath?: string;
  capabilities?: Partial<CapabilityFlags>;
  authPreflightRunner?: CliCommandRunner;
}): Phase1QueryFlow {
  const settingsAdapter = new FileContextSettingsAdapter(params.contextFilePath);
  const contextStore = new AdoContextStore(settingsAdapter);
  const authPreflight = new AzureCliPreflightAdapter(params.authPreflightRunner);
  const queryRuntime = new AzureQueryRuntimeAdapter(params.httpClient, contextStore);
  const iterationsAdapter = new AzureIterationsAdapter(params.httpClient, contextStore);
  const buildTimelineView = new BuildTimelineViewUseCase(iterationsAdapter);
  const mappingSettings = new FileMappingSettingsAdapter(
    params.mappingFilePath ?? path.join(path.dirname(params.contextFilePath), "mapping-settings.json")
  );

  const runQueryIntake = new RunQueryIntakeUseCase(
    authPreflight,
    queryRuntime,
    buildTimelineView,
    mappingSettings
  );

  const capabilities = resolveCapabilityFlags(params.capabilities);
  const writeCommandPort =
    capabilities.writeEnabled && params.httpClient.patch
      ? new WriteCommandAzureAdapter({ get: params.httpClient.get, patch: params.httpClient.patch }, contextStore)
      : new WriteCommandNoopAdapter();
  const submitWriteCommand = new SubmitWriteCommandUseCase(writeCommandPort);

  return {
    runQueryIntake,
    submitWriteCommand,
    capabilities
  };
}
