import type { WorkItemFieldDefinition } from "../dto/work-item-field-definition.js";

export interface WorkItemFieldDefinitionsPort {
  /**
   * Returns the fields defined for at least one of the given work item types,
   * each annotated with the work item types that define it.
   */
  listFieldDefinitions(workItemTypes: string[]): Promise<WorkItemFieldDefinition[]>;

  /** Returns the raw field type (e.g. "html", "string") for every known field reference name. */
  getFieldTypes(): Promise<Map<string, string>>;
}
