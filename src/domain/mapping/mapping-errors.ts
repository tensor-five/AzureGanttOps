import type { RequiredMappingField } from "./field-mapping.js";

export type MappingValidationErrorCode =
  | "MAP_REQUIRED_MISSING"
  | "MAP_REQUIRED_BLANK"
  | "MAP_REQUIRED_DUPLICATE";

export type MappingValidationIssue = {
  code: MappingValidationErrorCode;
  field: RequiredMappingField;
  message: string;
  guidance: string;
};

export class MappingValidationFailedError extends Error {
  public readonly code = "MAP_VALIDATION_FAILED";

  public constructor(public readonly errors: MappingValidationIssue[]) {
    super("MAP_VALIDATION_FAILED");
  }
}
