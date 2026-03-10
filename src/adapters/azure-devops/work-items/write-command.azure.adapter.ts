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
  get?: (url: string, headers?: Record<string, string>) => Promise<HttpResponse>;
  patch: (url: string, body: unknown, headers?: Record<string, string>) => Promise<HttpResponse>;
};

export class WriteCommandAzureAdapter implements WriteCommandPort {
  public constructor(
    private readonly httpClient: WorkItemWriteHttpClient,
    private readonly contextStore: AdoContextStore
  ) {}

  public async submit(command: WriteCommand): Promise<WriteCommandResult> {
    const context = await this.contextStore.getActiveContext();
    if (!context) {
      throw new Error("ADO_CONTEXT_MISSING");
    }

    if (command.kind === "WORK_ITEM_PATCH") {
      const url = buildWorkItemUrl({
        organization: context.organization,
        project: context.project,
        workItemId: command.workItemId
      });
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

    const sourceWorkItemUrl = buildWorkItemUrl({
      organization: context.organization,
      project: context.project,
      workItemId: command.sourceId
    });

    let operations: unknown[];
    if (command.action === "add") {
      const targetWorkItemReferenceUrl = buildWorkItemReferenceUrl({
        organization: context.organization,
        project: context.project,
        workItemId: command.targetId
      });
      operations = [
        {
          op: "add",
          path: "/relations/-",
          value: {
            rel: command.relation,
            url: targetWorkItemReferenceUrl
          }
        }
      ];
    } else if (command.action === "remove") {
      if (!this.httpClient.get) {
        throw new Error("DEPENDENCY_REMOVE_UNSUPPORTED");
      }

      const lookupUrl = buildWorkItemRelationLookupUrl({
        organization: context.organization,
        project: context.project,
        workItemId: command.sourceId
      });
      const lookupResponse = await this.httpClient.get(lookupUrl, {
        accept: "application/json"
      });
      if (lookupResponse.status < 200 || lookupResponse.status >= 300) {
        throw new Error("DEPENDENCY_LOOKUP_FAILED");
      }

      const relationIndex = resolveDependencyRelationIndex(lookupResponse.json, command.targetId, command.relation);
      if (relationIndex === null) {
        throw new Error("DEPENDENCY_NOT_FOUND");
      }

      operations = [
        {
          op: "remove",
          path: `/relations/${relationIndex}`
        }
      ];
    } else {
      throw new Error("DEPENDENCY_ACTION_UNSUPPORTED");
    }

    const response = await this.httpClient.patch(sourceWorkItemUrl, operations, {
      "content-type": "application/json-patch+json",
      accept: "application/json"
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error("DEPENDENCY_LINK_FAILED");
    }

    return {
      accepted: true,
      mode: "EXECUTED",
      commandKind: "DEPENDENCY_LINK",
      operationCount: 1,
      reasonCode: "WRITE_ENABLED"
    };
  }
}

function buildWorkItemUrl(input: { organization: string; project: string; workItemId: number }): string {
  return (
    `https://dev.azure.com/${encodeURIComponent(input.organization)}/${encodeURIComponent(input.project)}` +
    `/_apis/wit/workitems/${input.workItemId}?api-version=${API_VERSION}`
  );
}

function buildWorkItemReferenceUrl(input: { organization: string; project: string; workItemId: number }): string {
  return (
    `https://dev.azure.com/${encodeURIComponent(input.organization)}/${encodeURIComponent(input.project)}` +
    `/_apis/wit/workItems/${input.workItemId}`
  );
}

function buildWorkItemRelationLookupUrl(input: { organization: string; project: string; workItemId: number }): string {
  return (
    `https://dev.azure.com/${encodeURIComponent(input.organization)}/${encodeURIComponent(input.project)}` +
    `/_apis/wit/workitems/${input.workItemId}?$expand=relations&api-version=${API_VERSION}`
  );
}

function resolveDependencyRelationIndex(payload: unknown, targetId: number, relation: string): number | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const relations = (payload as { relations?: unknown }).relations;
  if (!Array.isArray(relations)) {
    return null;
  }

  for (let index = 0; index < relations.length; index += 1) {
    const relationEntry = relations[index];
    if (!relationEntry || typeof relationEntry !== "object") {
      continue;
    }

    const rel = (relationEntry as { rel?: unknown }).rel;
    if (rel !== relation) {
      continue;
    }

    const url = (relationEntry as { url?: unknown }).url;
    const relationTargetId = parseRelationTargetWorkItemId(typeof url === "string" ? url : null);
    if (relationTargetId === targetId) {
      return index;
    }
  }

  return null;
}

function parseRelationTargetWorkItemId(url: string | null): number | null {
  if (!url) {
    return null;
  }

  const match = /\/workitems\/(\d+)(?:$|[/?#])/i.exec(url);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}
