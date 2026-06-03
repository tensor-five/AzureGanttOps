import type {
  CreatedWorkItemSnapshot,
  WriteCommand,
  WriteCommandResult
} from "../../../application/dto/write-boundary/write-command.dto.js";
import type { WriteCommandPort } from "../../../application/ports/write-command.port.js";
import { AdoContextStore } from "../../../app/config/ado-context.store.js";

const API_VERSION = "7.1";
const DEFAULT_DUPLICATE_SCHEDULE_FIELD_REFS = {
  start: "Microsoft.VSTS.Scheduling.StartDate",
  endOrTarget: "Microsoft.VSTS.Scheduling.TargetDate"
};
const DUPLICATE_SYSTEM_FIELD_REFS = [
  "System.AssignedTo",
  "System.AreaPath",
  "System.IterationPath"
];
const CHILD_CREATE_SYSTEM_FIELD_REFS = [
  "System.AreaPath",
  "System.IterationPath"
];

type HttpResponse = {
  status: number;
  json: unknown;
  headers?: Record<string, string | undefined>;
};

export type WorkItemWriteHttpClient = {
  get?: (url: string, headers?: Record<string, string>) => Promise<HttpResponse>;
  post?: (url: string, body: unknown, headers?: Record<string, string>) => Promise<HttpResponse>;
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

    if (command.kind === "HIERARCHY_LINK") {
      return this.submitHierarchyLink(command, context);
    }

    if (command.kind === "WORK_ITEM_DUPLICATE") {
      return this.submitWorkItemDuplicate(command, context);
    }

    if (command.kind === "WORK_ITEM_CHILD_CREATE") {
      return this.submitWorkItemChildCreate(command, context);
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

  private async submitWorkItemDuplicate(
    command: Extract<WriteCommand, { kind: "WORK_ITEM_DUPLICATE" }>,
    context: { organization: string; project: string }
  ): Promise<WriteCommandResult> {
    if (!this.httpClient.get || !this.httpClient.post) {
      return {
        accepted: false,
        mode: "NO_OP",
        commandKind: "WORK_ITEM_DUPLICATE",
        operationCount: 1,
        reasonCode: "WRITE_UNSUPPORTED"
      };
    }

    const sourceUrl = buildWorkItemDuplicateSourceUrl({
      organization: context.organization,
      project: context.project,
      workItemId: command.sourceWorkItemId
    });
    const sourceResponse = await this.httpClient.get(sourceUrl, {
      accept: "application/json"
    });
    if (sourceResponse.status < 200 || sourceResponse.status >= 300) {
      throw new Error(buildAzureResponseErrorMessage("WORK_ITEM_DUPLICATE_SOURCE_FETCH_FAILED", sourceResponse.json));
    }

    const source = extractDuplicateSource(
      sourceResponse.json,
      resolveDuplicateScheduleFieldRefs(command.scheduleFieldRefs)
    );
    if (!source) {
      throw new Error("WORK_ITEM_DUPLICATE_SOURCE_MALFORMED");
    }

    const operations = buildDuplicateCreateOperations(source);
    const createUrl = buildWorkItemCreateUrl({
      organization: context.organization,
      project: context.project,
      workItemType: source.workItemType
    });
    const createResponse = await this.httpClient.post(createUrl, operations, {
      "content-type": "application/json-patch+json",
      accept: "application/json"
    });
    if (createResponse.status < 200 || createResponse.status >= 300) {
      throw new Error(buildAzureResponseErrorMessage("WORK_ITEM_DUPLICATE_FAILED", createResponse.json));
    }

    const createdWorkItemId = extractCreatedWorkItemId(createResponse.json) ?? undefined;
    const createdWorkItem = extractCreatedWorkItemSnapshot(
      createResponse.json,
      resolveDuplicateScheduleFieldRefs(command.scheduleFieldRefs)
    );

    return {
      accepted: true,
      mode: "EXECUTED",
      commandKind: "WORK_ITEM_DUPLICATE",
      operationCount: operations.length,
      reasonCode: "WRITE_ENABLED",
      ...(createdWorkItemId ? { createdWorkItemId } : {}),
      ...(createdWorkItem ? { createdWorkItem } : {})
    };
  }

  private async submitWorkItemChildCreate(
    command: Extract<WriteCommand, { kind: "WORK_ITEM_CHILD_CREATE" }>,
    context: { organization: string; project: string }
  ): Promise<WriteCommandResult> {
    if (!this.httpClient.get || !this.httpClient.post) {
      return {
        accepted: false,
        mode: "NO_OP",
        commandKind: "WORK_ITEM_CHILD_CREATE",
        operationCount: 1,
        reasonCode: "WRITE_UNSUPPORTED"
      };
    }

    const parentUrl = buildWorkItemUrl({
      organization: context.organization,
      project: context.project,
      workItemId: command.parentWorkItemId
    });
    const parentResponse = await this.httpClient.get(parentUrl, {
      accept: "application/json"
    });
    if (parentResponse.status < 200 || parentResponse.status >= 300) {
      throw new Error(buildAzureResponseErrorMessage("WORK_ITEM_CHILD_PARENT_FETCH_FAILED", parentResponse.json));
    }

    const parent = extractChildCreateParent(parentResponse.json);
    if (!parent) {
      throw new Error("WORK_ITEM_CHILD_PARENT_MALFORMED");
    }

    const childWorkItemType = command.childWorkItemType.trim();

    const operations = buildChildCreateOperations({
      childWorkItemType,
      title: command.title,
      systemFields: parent.systemFields,
      parentRelationUrl: buildWorkItemReferenceUrl({
        organization: context.organization,
        project: context.project,
        workItemId: command.parentWorkItemId
      })
    });
    const createUrl = buildWorkItemCreateUrl({
      organization: context.organization,
      project: context.project,
      workItemType: childWorkItemType
    });
    const createResponse = await this.httpClient.post(createUrl, operations, {
      "content-type": "application/json-patch+json",
      accept: "application/json"
    });
    if (createResponse.status < 200 || createResponse.status >= 300) {
      throw new Error(buildAzureResponseErrorMessage("WORK_ITEM_CHILD_CREATE_FAILED", createResponse.json));
    }

    const createdWorkItemId = extractCreatedWorkItemId(createResponse.json) ?? undefined;
    const createdWorkItem = extractCreatedChildWorkItemSnapshot(
      createResponse.json,
      command.parentWorkItemId,
      resolveDuplicateScheduleFieldRefs(command.scheduleFieldRefs)
    );

    return {
      accepted: true,
      mode: "EXECUTED",
      commandKind: "WORK_ITEM_CHILD_CREATE",
      operationCount: operations.length,
      reasonCode: "WRITE_ENABLED",
      ...(createdWorkItemId ? { createdWorkItemId } : {}),
      ...(createdWorkItem ? { createdWorkItem } : {})
    };
  }

  private async submitHierarchyLink(
    command: Extract<WriteCommand, { kind: "HIERARCHY_LINK" }>,
    context: { organization: string; project: string }
  ): Promise<WriteCommandResult> {
    if (!this.httpClient.get) {
      throw new Error("HIERARCHY_LINK_UNSUPPORTED");
    }

    const childWorkItemUrl = buildWorkItemUrl({
      organization: context.organization,
      project: context.project,
      workItemId: command.childWorkItemId
    });

    const lookupUrl = buildWorkItemRelationLookupUrl({
      organization: context.organization,
      project: context.project,
      workItemId: command.childWorkItemId
    });
    const lookupResponse = await this.httpClient.get(lookupUrl, {
      accept: "application/json"
    });
    if (lookupResponse.status < 200 || lookupResponse.status >= 300) {
      throw new Error("HIERARCHY_LOOKUP_FAILED");
    }

    const operations: unknown[] = [];

    const existingParentIndex = resolveRelationIndex(
      lookupResponse.json,
      null,
      "System.LinkTypes.Hierarchy-Reverse"
    );
    if (existingParentIndex !== null) {
      operations.push({ op: "remove", path: `/relations/${existingParentIndex}` });
    }

    if (command.newParentWorkItemId !== null) {
      const parentReferenceUrl = buildWorkItemReferenceUrl({
        organization: context.organization,
        project: context.project,
        workItemId: command.newParentWorkItemId
      });
      operations.push({
        op: "add",
        path: "/relations/-",
        value: {
          rel: "System.LinkTypes.Hierarchy-Reverse",
          url: parentReferenceUrl
        }
      });
    }

    if (operations.length === 0) {
      return {
        accepted: true,
        mode: "NO_OP",
        commandKind: "HIERARCHY_LINK",
        operationCount: 0,
        reasonCode: "WRITE_ENABLED"
      };
    }

    const response = await this.httpClient.patch(childWorkItemUrl, operations, {
      "content-type": "application/json-patch+json",
      accept: "application/json"
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error("HIERARCHY_LINK_FAILED");
    }

    return {
      accepted: true,
      mode: "EXECUTED",
      commandKind: "HIERARCHY_LINK",
      operationCount: operations.length,
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

function buildWorkItemDuplicateSourceUrl(input: { organization: string; project: string; workItemId: number }): string {
  return (
    `https://dev.azure.com/${encodeURIComponent(input.organization)}/${encodeURIComponent(input.project)}` +
    `/_apis/wit/workitems/${input.workItemId}?$expand=relations&api-version=${API_VERSION}`
  );
}

function buildWorkItemCreateUrl(input: { organization: string; project: string; workItemType: string }): string {
  return (
    `https://dev.azure.com/${encodeURIComponent(input.organization)}/${encodeURIComponent(input.project)}` +
    `/_apis/wit/workitems/$${encodeURIComponent(input.workItemType)}?api-version=${API_VERSION}`
  );
}

type DuplicateSource = {
  title: string;
  descriptionHtml: string | null;
  workItemType: string;
  tags: string | null;
  systemFields: DuplicateFieldValue[];
  dateFields: DuplicateFieldValue[];
  parentRelationUrl: string | null;
};

type DuplicateFieldValue = {
  fieldRef: string;
  value: string;
};

type DuplicateScheduleFieldRefs = {
  start: string;
  endOrTarget: string;
};

type ChildCreateParent = {
  systemFields: DuplicateFieldValue[];
};

type ChildCreateOperationsInput = {
  childWorkItemType: string;
  title?: string;
  systemFields: DuplicateFieldValue[];
  parentRelationUrl: string;
};

function extractDuplicateSource(payload: unknown, scheduleFieldRefs: readonly string[]): DuplicateSource | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const fields = (payload as { fields?: unknown }).fields;
  if (!fields || typeof fields !== "object") {
    return null;
  }

  const fieldRecord = fields as Record<string, unknown>;
  const title = fieldRecord["System.Title"];
  const workItemType = fieldRecord["System.WorkItemType"];
  if (typeof title !== "string" || title.trim().length === 0 || typeof workItemType !== "string" || workItemType.trim().length === 0) {
    return null;
  }

  const description = fieldRecord["System.Description"];
  const tags = fieldRecord["System.Tags"];

  return {
    title,
    descriptionHtml: typeof description === "string" && description.trim().length > 0 ? description : null,
    workItemType: workItemType.trim(),
    tags: typeof tags === "string" && tags.trim().length > 0 ? tags : null,
    systemFields: extractDuplicateSystemFields(fieldRecord),
    dateFields: extractStringFields(fieldRecord, scheduleFieldRefs),
    parentRelationUrl: extractParentRelationUrl(payload)
  };
}

function buildDuplicateCreateOperations(source: DuplicateSource): unknown[] {
  const operations: unknown[] = [
    { op: "add", path: "/fields/System.Title", value: appendCopySuffix(source.title) }
  ];

  if (source.descriptionHtml !== null) {
    operations.push({ op: "add", path: "/fields/System.Description", value: source.descriptionHtml });
  }

  if (source.tags !== null) {
    operations.push({ op: "add", path: "/fields/System.Tags", value: source.tags });
  }

  for (const systemField of source.systemFields) {
    operations.push({ op: "add", path: `/fields/${systemField.fieldRef}`, value: systemField.value });
  }

  for (const dateField of source.dateFields) {
    operations.push({ op: "add", path: `/fields/${dateField.fieldRef}`, value: dateField.value });
  }

  if (source.parentRelationUrl !== null) {
    operations.push({
      op: "add",
      path: "/relations/-",
      value: {
        rel: "System.LinkTypes.Hierarchy-Reverse",
        url: source.parentRelationUrl
      }
    });
  }

  return operations;
}

function extractChildCreateParent(payload: unknown): ChildCreateParent | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const fields = (payload as { fields?: unknown }).fields;
  if (!fields || typeof fields !== "object") {
    return null;
  }

  const fieldRecord = fields as Record<string, unknown>;
  return {
    systemFields: extractStringFields(fieldRecord, CHILD_CREATE_SYSTEM_FIELD_REFS)
  };
}

function buildChildCreateOperations(input: ChildCreateOperationsInput): unknown[] {
  const operations: unknown[] = [
    {
      op: "add",
      path: "/fields/System.Title",
      value: resolveChildCreateTitle(input.title, input.childWorkItemType)
    }
  ];

  for (const systemField of input.systemFields) {
    operations.push({ op: "add", path: `/fields/${systemField.fieldRef}`, value: systemField.value });
  }

  operations.push({
    op: "add",
    path: "/relations/-",
    value: {
      rel: "System.LinkTypes.Hierarchy-Reverse",
      url: input.parentRelationUrl
    }
  });

  return operations;
}

function resolveChildCreateTitle(title: string | undefined, childWorkItemType: string): string {
  const trimmed = title?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : `New ${childWorkItemType}`;
}

function appendCopySuffix(title: string): string {
  return `${title} (copy)`;
}

function extractStringFields(fields: Record<string, unknown>, fieldRefs: readonly string[]): DuplicateFieldValue[] {
  return fieldRefs.flatMap((fieldRef) => {
    const value = fields[fieldRef];
    const stringValue = extractStringFieldValue(value);
    return stringValue !== null ? [{ fieldRef, value: stringValue }] : [];
  });
}

function extractDuplicateSystemFields(fields: Record<string, unknown>): DuplicateFieldValue[] {
  return DUPLICATE_SYSTEM_FIELD_REFS.flatMap((fieldRef) => {
    const value = fieldRef === "System.AssignedTo"
      ? extractAssignedToFieldValue(fields[fieldRef])
      : extractStringFieldValue(fields[fieldRef]);
    return value !== null ? [{ fieldRef, value }] : [];
  });
}

function extractAssignedToFieldValue(value: unknown): string | null {
  const directValue = extractStringFieldValue(value);
  if (directValue !== null) {
    return directValue;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const identity = value as Record<string, unknown>;
  const uniqueName = extractStringFieldValue(identity.uniqueName);
  if (uniqueName !== null) {
    return uniqueName.trim();
  }

  const displayName = extractStringFieldValue(identity.displayName);
  return displayName !== null ? displayName.trim() : null;
}

function extractStringFieldValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function resolveDuplicateScheduleFieldRefs(input: DuplicateScheduleFieldRefs | undefined): string[] {
  const refs = input
    ? [input.start, input.endOrTarget]
    : [DEFAULT_DUPLICATE_SCHEDULE_FIELD_REFS.start, DEFAULT_DUPLICATE_SCHEDULE_FIELD_REFS.endOrTarget];
  return [...new Set(refs.map((fieldRef) => fieldRef.trim()).filter(Boolean))];
}

function extractParentRelationUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const relations = (payload as { relations?: unknown }).relations;
  if (!Array.isArray(relations)) {
    return null;
  }

  for (const relationEntry of relations) {
    if (!relationEntry || typeof relationEntry !== "object") {
      continue;
    }

    const rel = (relationEntry as { rel?: unknown }).rel;
    const url = (relationEntry as { url?: unknown }).url;
    if (rel === "System.LinkTypes.Hierarchy-Reverse" && typeof url === "string" && url.trim().length > 0) {
      return url.trim();
    }
  }

  return null;
}

function extractCreatedWorkItemSnapshot(payload: unknown, scheduleFieldRefs: readonly string[]): CreatedWorkItemSnapshot | null {
  const id = extractCreatedWorkItemId(payload);
  if (id === null || !payload || typeof payload !== "object") {
    return null;
  }

  const fields = (payload as { fields?: unknown }).fields;
  if (!fields || typeof fields !== "object") {
    return null;
  }

  const fieldRecord = fields as Record<string, unknown>;
  const schedule = extractCreatedWorkItemSchedule(fieldRecord, scheduleFieldRefs);
  const parentWorkItemId = extractParentWorkItemId(payload);

  return {
    id,
    title: extractStringFieldValue(fieldRecord["System.Title"]),
    state: extractStringFieldValue(fieldRecord["System.State"]),
    descriptionHtml: extractStringFieldValue(fieldRecord["System.Description"]),
    workItemType: extractStringFieldValue(fieldRecord["System.WorkItemType"]),
    assignedTo: extractAssignedToFieldValue(fieldRecord["System.AssignedTo"]),
    fieldValues: extractPrimitiveFieldValues(fieldRecord),
    ...(parentWorkItemId !== undefined ? { parentWorkItemId } : {}),
    ...(schedule ? { schedule } : {})
  };
}

function extractCreatedChildWorkItemSnapshot(
  payload: unknown,
  parentWorkItemId: number,
  scheduleFieldRefs: readonly string[]
): CreatedWorkItemSnapshot | null {
  const snapshot = extractCreatedWorkItemSnapshot(payload, scheduleFieldRefs);
  if (snapshot) {
    return {
      ...snapshot,
      parentWorkItemId
    };
  }

  const id = extractCreatedWorkItemId(payload);
  return id !== null
    ? {
        id,
        parentWorkItemId
      }
    : null;
}

function extractCreatedWorkItemSchedule(
  fields: Record<string, unknown>,
  scheduleFieldRefs: readonly string[]
): CreatedWorkItemSnapshot["schedule"] | null {
  const [startFieldRef, endFieldRef] = scheduleFieldRefs;
  const schedule: NonNullable<CreatedWorkItemSnapshot["schedule"]> = {};

  if (startFieldRef && Object.prototype.hasOwnProperty.call(fields, startFieldRef)) {
    schedule.startDate = extractStringFieldValue(fields[startFieldRef]);
  }

  if (endFieldRef && Object.prototype.hasOwnProperty.call(fields, endFieldRef)) {
    schedule.endDate = extractStringFieldValue(fields[endFieldRef]);
  }

  return Object.keys(schedule).length > 0 ? schedule : null;
}

function extractPrimitiveFieldValues(fields: Record<string, unknown>): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};
  for (const [fieldRef, value] of Object.entries(fields)) {
    if (typeof value === "string" || typeof value === "number" || value === null) {
      result[fieldRef] = value;
    }
  }

  return result;
}

function extractParentWorkItemId(payload: unknown): number | null | undefined {
  const parentRelationUrl = extractParentRelationUrl(payload);
  if (parentRelationUrl === null) {
    return hasRelationsArray(payload) ? null : undefined;
  }

  return extractWorkItemIdFromRelationUrl(parentRelationUrl);
}

function hasRelationsArray(payload: unknown): boolean {
  return Boolean(payload && typeof payload === "object" && Array.isArray((payload as { relations?: unknown }).relations));
}

function extractWorkItemIdFromRelationUrl(targetUrl: string): number | null {
  const match = targetUrl.match(/\/_apis\/wit\/workitems\/(\d+)(?:$|[/?#])/i);
  if (!match) {
    return null;
  }

  const id = Number.parseInt(match[1], 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function extractCreatedWorkItemId(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const id = (payload as { id?: unknown }).id;
  return typeof id === "number" && Number.isFinite(id) && id > 0 ? id : null;
}

function buildAzureResponseErrorMessage(fallback: string, payload: unknown): string {
  const azureMessage = extractAzureErrorMessage(payload);
  return azureMessage ? `${fallback}: ${azureMessage}` : fallback;
}

function extractAzureErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string") {
    return normalizeErrorText(payload);
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  for (const key of ["message", "Message", "errorMessage"]) {
    const message = record[key];
    if (typeof message === "string") {
      return normalizeErrorText(message);
    }
  }

  const innerException = record.innerException;
  if (innerException && typeof innerException === "object") {
    const innerMessage = (innerException as Record<string, unknown>).message;
    if (typeof innerMessage === "string") {
      return normalizeErrorText(innerMessage);
    }
  }

  return null;
}

function normalizeErrorText(value: string): string | null {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized.length > 1000 ? `${normalized.slice(0, 997)}...` : normalized;
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

function resolveRelationIndex(payload: unknown, targetId: number | null, relation: string): number | null {
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

    if (targetId === null) {
      return index;
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
