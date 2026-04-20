import { describe, expect, it } from "vitest";
import {
  extractIterationPath,
  shouldUseIterationScheduling
} from "./iteration-scheduling.js";

describe("iteration-scheduling", () => {
  describe("extractIterationPath", () => {
    it("extracts project and iteration from standard path", () => {
      const result = extractIterationPath({
        "System.IterationPath": "ProjectA\\Sprint 1"
      });

      expect(result).toEqual({
        projectName: "ProjectA",
        iterationPath: "ProjectA\\Sprint 1"
      });
    });

    it("extracts project name from root iteration (no sprint)", () => {
      const result = extractIterationPath({
        "System.IterationPath": "ProjectB"
      });

      expect(result).toEqual({
        projectName: "ProjectB",
        iterationPath: "ProjectB"
      });
    });

    it("extracts project from nested iteration path", () => {
      const result = extractIterationPath({
        "System.IterationPath": "MyProject\\Release 1\\Sprint 2"
      });

      expect(result).toEqual({
        projectName: "MyProject",
        iterationPath: "MyProject\\Release 1\\Sprint 2"
      });
    });

    it("returns null if iteration path is missing", () => {
      const result = extractIterationPath({
        "System.State": "Active"
      });

      expect(result).toBeNull();
    });

    it("returns null if iteration path is empty string", () => {
      const result = extractIterationPath({
        "System.IterationPath": ""
      });

      expect(result).toBeNull();
    });

    it("returns null if iteration path is whitespace only", () => {
      const result = extractIterationPath({
        "System.IterationPath": "   "
      });

      expect(result).toBeNull();
    });

    it("returns null if fieldValues is undefined", () => {
      const result = extractIterationPath(undefined);

      expect(result).toBeNull();
    });

    it("trims whitespace from iteration path", () => {
      const result = extractIterationPath({
        "System.IterationPath": "  ProjectC  \\  Sprint 3  "
      });

      expect(result).toEqual({
        projectName: "ProjectC",
        iterationPath: "ProjectC  \\  Sprint 3"
      });
    });
  });

  describe("shouldUseIterationScheduling", () => {
    it("returns true when item has no dates but has iteration", () => {
      const result = shouldUseIterationScheduling({
        hasExplicitStartDate: false,
        hasExplicitEndDate: false,
        iterationPath: {
          projectName: "ProjectA",
          iterationPath: "ProjectA\\Sprint 1"
        }
      });

      expect(result).toBe(true);
    });

    it("returns false when item has start date", () => {
      const result = shouldUseIterationScheduling({
        hasExplicitStartDate: true,
        hasExplicitEndDate: false,
        iterationPath: {
          projectName: "ProjectA",
          iterationPath: "ProjectA\\Sprint 1"
        }
      });

      expect(result).toBe(false);
    });

    it("returns false when item has end date", () => {
      const result = shouldUseIterationScheduling({
        hasExplicitStartDate: false,
        hasExplicitEndDate: true,
        iterationPath: {
          projectName: "ProjectA",
          iterationPath: "ProjectA\\Sprint 1"
        }
      });

      expect(result).toBe(false);
    });

    it("returns false when item has both dates", () => {
      const result = shouldUseIterationScheduling({
        hasExplicitStartDate: true,
        hasExplicitEndDate: true,
        iterationPath: {
          projectName: "ProjectA",
          iterationPath: "ProjectA\\Sprint 1"
        }
      });

      expect(result).toBe(false);
    });

    it("returns false when item has no iteration path", () => {
      const result = shouldUseIterationScheduling({
        hasExplicitStartDate: false,
        hasExplicitEndDate: false,
        iterationPath: null
      });

      expect(result).toBe(false);
    });
  });
});
