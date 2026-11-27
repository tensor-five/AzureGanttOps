/**
 * Azure-agnostic description of a work item field as defined by the tracking system.
 * `type` carries the raw field type reported by the source (e.g. "double", "html").
 */
export type WorkItemFieldDefinition = {
  referenceName: string;
  name: string;
  type: string;
  readOnly: boolean;
  isIdentity: boolean;
  allowedValues: string[];
  workItemTypes: string[];
};
