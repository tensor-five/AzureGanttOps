import {
  type FieldMappingProfile,
  normalizeProfile,
  type RequiredFieldMappings,
  type RequiredMappingField
} from "./field-mapping.js";
import { MappingValidationFailedError, type MappingValidationIssue } from "./mapping-errors.js";

const FIELD_LABEL: Record<RequiredMappingField, string> = {
  id: "ID",
  title: "Title",
  start: "Start Date",
  endOrTarget: "End/Target Date"
};

export function validateRequiredMappings(profile: FieldMappingProfile): RequiredFieldMappings {
  const normalized = normalizeProfile(profile);
  const issues: MappingValidationIssue[] = [];
  const completeFields = {} as RequiredFieldMappings;

  (Object.keys(FIELD_LABEL) as RequiredMappingField[]).forEach((field) => {
    const rawValue = (normalized.fields as Record<string, unknown>)[field];

    if (typeof rawValue !== "string") {
      issues.push({
        code: "MAP_REQUIRED_MISSING",
        field,
        message: `${FIELD_LABEL[field]} mapping is required.`,
        guidance: `Assign an Azure field reference for ${FIELD_LABEL[field]}.`
      });
      return;
    }

    const trimmedValue = rawValue.trim();

    if (trimmedValue.length === 0) {
      issues.push({
        code: "MAP_REQUIRED_BLANK",
        field,
        message: `${FIELD_LABEL[field]} mapping cannot be blank.`,
        guidance: `Provide a non-empty Azure field reference for ${FIELD_LABEL[field]}.`
      });
      return;
    }

    completeFields[field] = trimmedValue;
  });

  const duplicates = findDuplicateFields(completeFields);
  duplicates.forEach(([field, duplicateField]) => {
    issues.push({
      code: "MAP_REQUIRED_DUPLICATE",
      field,
      message: `${FIELD_LABEL[field]} mapping duplicates ${FIELD_LABEL[duplicateField]}.`,
      guidance: `Choose a unique Azure field reference for ${FIELD_LABEL[field]}.`
    });
  });

  if (issues.length > 0) {
    throw new MappingValidationFailedError(issues);
  }

  return completeFields;
}

function findDuplicateFields(
  fields: Partial<Record<RequiredMappingField, string>>
): Array<[RequiredMappingField, RequiredMappingField]> {
  const entries = (Object.keys(FIELD_LABEL) as RequiredMappingField[])
    .map((field) => [field, fields[field]] as const)
    .filter((entry): entry is readonly [RequiredMappingField, string] => typeof entry[1] === "string");

  const duplicatePairs: Array<[RequiredMappingField, RequiredMappingField]> = [];

  for (let index = 0; index < entries.length; index += 1) {
    const [field, value] = entries[index];

    for (let compareIndex = index + 1; compareIndex < entries.length; compareIndex += 1) {
      const [compareField, compareValue] = entries[compareIndex];

      if (value.toLowerCase() === compareValue.toLowerCase()) {
        duplicatePairs.push([field, compareField], [compareField, field]);
      }
    }
  }

  return duplicatePairs;
}
