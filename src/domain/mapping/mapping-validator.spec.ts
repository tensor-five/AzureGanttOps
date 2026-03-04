import { describe, expect, it } from "vitest";

import type { FieldMappingProfile } from "./field-mapping.js";
import { MappingValidationFailedError } from "./mapping-errors.js";
import { validateRequiredMappings } from "./mapping-validator.js";

function createValidProfile(overrides?: Partial<FieldMappingProfile["fields"]>): FieldMappingProfile {
  return {
    id: "default-profile",
    name: "Default",
    fields: {
      id: "System.Id",
      title: "System.Title",
      start: "Microsoft.VSTS.Scheduling.StartDate",
      endOrTarget: "Microsoft.VSTS.Scheduling.TargetDate",
      ...overrides
    }
  };
}

describe("validateRequiredMappings", () => {
  // MAP-01: supports required semantic fields id/title/start/endOrTarget.
  it("accepts a valid required mapping profile and trims values", () => {
    const profile = createValidProfile({
      id: "  System.Id  ",
      title: " System.Title "
    });

    expect(validateRequiredMappings(profile)).toEqual({
      id: "System.Id",
      title: "System.Title",
      start: "Microsoft.VSTS.Scheduling.StartDate",
      endOrTarget: "Microsoft.VSTS.Scheduling.TargetDate"
    });
  });

  // MAP-02: blocks timeline readiness when required fields are missing.
  it("rejects missing required mapping with deterministic field guidance", () => {
    const profile = createValidProfile();
    (profile.fields as unknown as Record<string, unknown>).start = undefined;

    expect(() => validateRequiredMappings(profile)).toThrowError(MappingValidationFailedError);

    try {
      validateRequiredMappings(profile);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(MappingValidationFailedError);
      const validationError = error as MappingValidationFailedError;
      expect(validationError.errors).toEqual([
        {
          code: "MAP_REQUIRED_MISSING",
          field: "start",
          message: "Start Date mapping is required.",
          guidance: "Assign an Azure field reference for Start Date."
        }
      ]);
    }
  });

  // MAP-02: rejects blank required field assignments with fix guidance.
  it("rejects blank required mapping with deterministic guidance", () => {
    const profile = createValidProfile({ endOrTarget: "   " });

    expect(() => validateRequiredMappings(profile)).toThrowError(MappingValidationFailedError);

    try {
      validateRequiredMappings(profile);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(MappingValidationFailedError);
      const validationError = error as MappingValidationFailedError;
      expect(validationError.errors).toEqual([
        {
          code: "MAP_REQUIRED_BLANK",
          field: "endOrTarget",
          message: "End/Target Date mapping cannot be blank.",
          guidance: "Provide a non-empty Azure field reference for End/Target Date."
        }
      ]);
    }
  });

  // MAP-02: rejects duplicate semantic mapping assignments to prevent ambiguity.
  it("rejects duplicate required mappings case-insensitively", () => {
    const profile = createValidProfile({
      start: "Custom.Date",
      endOrTarget: " custom.date "
    });

    expect(() => validateRequiredMappings(profile)).toThrowError(MappingValidationFailedError);

    try {
      validateRequiredMappings(profile);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(MappingValidationFailedError);
      const validationError = error as MappingValidationFailedError;
      expect(validationError.errors).toEqual([
        {
          code: "MAP_REQUIRED_DUPLICATE",
          field: "start",
          message: "Start Date mapping duplicates End/Target Date.",
          guidance: "Choose a unique Azure field reference for Start Date."
        },
        {
          code: "MAP_REQUIRED_DUPLICATE",
          field: "endOrTarget",
          message: "End/Target Date mapping duplicates Start Date.",
          guidance: "Choose a unique Azure field reference for End/Target Date."
        }
      ]);
    }
  });
});
