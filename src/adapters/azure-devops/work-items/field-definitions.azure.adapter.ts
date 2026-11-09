import type { WorkItemFieldDefinition } from "../../../application/dto/work-item-field-definition.js";
import type { WorkItemFieldDefinitionsPort } from "../../../application/ports/work-item-field-definitions.port.js";
import type { AdoContext } from "../../../application/ports/context-settings.port.js";
import type { HttpClient } from "../queries/azure-query-runtime.adapter.js";

const API_VERSION = "7.1";

type ProjectField = {
  referenceName: string;
  name: string;
  type: string;
  readOnly: boolean;
  isIdentity: boolean;
};

type TypeField = {
  referenceName: string;
  name: string;
  allowedValues: string[];
};

export class AzureFieldDefinitionsAdapter implements WorkItemFieldDefinitionsPort {
  public constructor(
    private readonly httpClient: HttpClient,
    private readonly resolveContext: () => Promise<AdoContext | null>
  ) {}

  public async listFieldDefinitions(workItemTypes: string[]): Promise<WorkItemFieldDefinition[]> {
    const context = await this.resolveContext();
    if (!context) {
      throw new Error("ADO_CONTEXT_MISSING");
    }

    const uniqueTypes = [...new Set(workItemTypes.map((type) => type.trim()).filter((type) => type.length > 0))];
    const baseUrl = `https://dev.azure.com/${encodeURIComponent(context.organization)}/${encodeURIComponent(context.project)}/_apis/wit`;

    const [projectFields, typeFieldLists] = await Promise.all([
      this.fetchProjectFields(`${baseUrl}/fields?api-version=${API_VERSION}`),
      Promise.all(
        uniqueTypes.map(async (type) => ({
          type,
          fields: await this.fetchTypeFields(
            `${baseUrl}/workitemtypes/${encodeURIComponent(type)}/fields?$expand=allowedValues&api-version=${API_VERSION}`
          )
        }))
      )
    ]);

    return mergeFieldDefinitions(projectFields, typeFieldLists);
  }

  private async fetchProjectFields(url: string): Promise<Map<string, ProjectField>> {
    const response = await this.httpClient.get(url);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`FIELD_DEFINITIONS_FETCH_FAILED:${response.status}`);
    }

    const fields = new Map<string, ProjectField>();
    readValueArray(response.json).forEach((entry) => {
      const referenceName = readString(entry.referenceName);
      if (!referenceName) {
        return;
      }

      fields.set(referenceName, {
        referenceName,
        name: readString(entry.name) ?? referenceName,
        type: readString(entry.type) ?? "",
        readOnly: entry.readOnly === true,
        isIdentity: entry.isIdentity === true
      });
    });
    return fields;
  }

  private async fetchTypeFields(url: string): Promise<TypeField[]> {
    const response = await this.httpClient.get(url);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`WORK_ITEM_TYPE_FIELDS_FETCH_FAILED:${response.status}`);
    }

    return readValueArray(response.json).flatMap((entry) => {
      const referenceName = readString(entry.referenceName);
      if (!referenceName) {
        return [];
      }

      return [
        {
          referenceName,
          name: readString(entry.name) ?? referenceName,
          allowedValues: Array.isArray(entry.allowedValues)
            ? entry.allowedValues.filter((value): value is string => typeof value === "string")
            : []
        }
      ];
    });
  }
}

export function mergeFieldDefinitions(
  projectFields: Map<string, ProjectField>,
  typeFieldLists: Array<{ type: string; fields: TypeField[] }>
): WorkItemFieldDefinition[] {
  const merged = new Map<string, WorkItemFieldDefinition>();

  typeFieldLists.forEach(({ type, fields }) => {
    fields.forEach((typeField) => {
      const existing = merged.get(typeField.referenceName);
      if (existing) {
        if (!existing.workItemTypes.includes(type)) {
          existing.workItemTypes.push(type);
        }
        if (existing.allowedValues.length === 0 && typeField.allowedValues.length > 0) {
          existing.allowedValues = [...typeField.allowedValues];
        }
        return;
      }

      const projectField = projectFields.get(typeField.referenceName);
      merged.set(typeField.referenceName, {
        referenceName: typeField.referenceName,
        name: projectField?.name ?? typeField.name,
        type: projectField?.type ?? "",
        readOnly: projectField?.readOnly ?? false,
        isIdentity: projectField?.isIdentity ?? false,
        allowedValues: [...typeField.allowedValues],
        workItemTypes: [type]
      });
    });
  });

  return [...merged.values()];
}

function readValueArray(payload: unknown): Array<Record<string, unknown>> {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const value = (payload as { value?: unknown }).value;
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    : [];
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
