import type { WriteCommand, WriteCommandResult } from "../../../application/dto/write-boundary/write-command.dto.js";
import type { WriteCommandPort } from "../../../application/ports/write-command.port.js";
import { AdoContextStore } from "../../../app/config/ado-context.store.js";

const API_VERSION = "7.1";

type HttpResponse = {
  status: number;
  json: unknown;
  headers?: Record<string, string | undefined>;
};

export type WorkItemWriteHttpClient = {
  patch: (url: string, body: unknown, headers?: Record<string, string>) => Promise<HttpResponse>;
};

export class WriteCommandAzureAdapter implements WriteCommandPort {
  public constructor(
    private readonly httpClient: WorkItemWriteHttpClient,
    private readonly contextStore: AdoContextStore
  ) {}

  public async submit(command: WriteCommand): Promise<WriteCommandResult> {
    if (command.kind !== "WORK_ITEM_PATCH") {
      throw new Error("WRITE_COMMAND_UNSUPPORTED");
    }

    const context = await this.contextStore.getActiveContext();
    if (!context) {
      throw new Error("ADO_CONTEXT_MISSING");
    }

    const url = `https://dev.azure.com/${context.organization}/${context.project}/_apis/wit/workitems/${command.workItemId}?api-version=${API_VERSION}`;
    const operations = command.expectedRevision
      ? [{ op: "test", path: "/rev", value: command.expectedRevision }, ...command.operations]
      : command.operations;

    const response = await this.httpClient.patch(url, operations, {
      "content-type": "application/json-patch+json",
      accept: "application/json"
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error("WORK_ITEM_PATCH_FAILED");
    }

    return {
      accepted: true,
      mode: "EXECUTED",
      commandKind: "WORK_ITEM_PATCH",
      operationCount: operations.length,
      reasonCode: "WRITE_ENABLED"
    };
  }
}
