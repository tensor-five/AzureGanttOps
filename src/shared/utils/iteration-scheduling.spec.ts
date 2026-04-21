import { describe, expect, it } from "vitest";
import { buildIterationDatesMap, extractIterationPath } from "./iteration-scheduling.js";

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

    it("trims outer whitespace from iteration path", () => {
      const result = extractIterationPath({
        "System.IterationPath": "  ProjectC  \\  Sprint 3  "
      });

      expect(result).toEqual({
        projectName: "ProjectC",
        iterationPath: "ProjectC  \\  Sprint 3"
      });
    });
  });

  describe("buildIterationDatesMap", () => {
    it("maps iterations with both dates by full path and last segment", () => {
      const result = buildIterationDatesMap([
        {
          path: "ProjectA\\Release 1\\Sprint 1",
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-14T00:00:00.000Z"
        }
      ]);

      expect(result).toEqual({
        "ProjectA\\Release 1\\Sprint 1": {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-14T00:00:00.000Z"
        },
        "Sprint 1": {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-14T00:00:00.000Z"
        }
      });
    });

    it("skips iterations without both dates", () => {
      const result = buildIterationDatesMap([
        { path: "ProjectA\\Sprint 1", startDate: null, endDate: "2026-03-14T00:00:00.000Z" },
        { path: "ProjectA\\Sprint 2", startDate: "2026-03-15T00:00:00.000Z", endDate: null }
      ]);

      expect(result).toEqual({});
    });
  });
});
