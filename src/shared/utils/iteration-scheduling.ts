/**
 * Iteration-based scheduling support
 *
 * Azure DevOps stores work items against System.IterationPath, but iteration
 * metadata (start/end dates) is not included in standard work item hydration.
 *
 * To enable iteration-based scheduling for unscheduled items:
 * 1. Extract System.IterationPath from fieldValues
 * 2. Resolve iteration dates from iteration metadata (requires additional API calls)
 * 3. Use iteration dates as fallback when item lacks explicit start/end dates
 *
 * [@TODO] Implement iteration date resolver when iteration API is available.
 * See: https://learn.microsoft.com/en-us/rest/api/azure/devops/work/iterations/list
 *
 * Current status: Foundation only (extracts iteration path, marks items as
 * iteration-schedulable, but does not yet resolve actual iteration dates).
 */

export type IterationPath = {
  projectName: string;
  iterationPath: string;
};

/**
 * Extract iteration path from work item field values.
 * Returns null if field is missing or invalid.
 *
 * System.IterationPath format examples:
 * - "ProjectName"
 * - "ProjectName\Sprint 1"
 * - "ProjectName\Release 1\Sprint 2"
 */
export function extractIterationPath(
  fieldValues: Record<string, string | number | null> | undefined
): IterationPath | null {
  if (!fieldValues) {
    return null;
  }

  const iterationPath = fieldValues["System.IterationPath"];

  if (typeof iterationPath !== "string" || !iterationPath.trim()) {
    return null;
  }

  // Parse project name (first path segment before backslash)
  const segments = iterationPath.split("\\");
  const projectName = segments[0]?.trim() ?? "";

  if (!projectName) {
    return null;
  }

  return {
    projectName,
    iterationPath: iterationPath.trim()
  };
}

/**
 * Convert iteration metadata to a map keyed by iteration path.
 * Creates a lookup: "ProjectName\Sprint 1" -> {startDate, endDate}
 * Also creates entries without project prefix for fallback matching.
 * 
 * This map is used by projectTimeline() for iteration-based scheduling fallback.
 */
export function buildIterationDatesMap(
  iterations: Array<{ path: string; startDate: string | null; endDate: string | null }>
): Record<string, { startDate: string; endDate: string }> {
  const result: Record<string, { startDate: string; endDate: string }> = {};

  console.log("[buildIterationDatesMap] Input iterations:", JSON.stringify(iterations, null, 2));

  for (const iter of iterations) {
    console.log("[buildIterationDatesMap-item]", {
      path: iter.path,
      startDate: iter.startDate,
      endDate: iter.endDate,
      hasBothDates: !!(iter.path && iter.startDate && iter.endDate),
    });

    // Only include iterations that have both dates defined
    if (iter.path && iter.startDate && iter.endDate) {
      // Add entry with full path
      result[iter.path] = {
        startDate: iter.startDate,
        endDate: iter.endDate
      };
      
      console.log(`[buildIterationDatesMap-added] Full path: "${iter.path}"`);
      
      // Also add entry with just the sprint name (last segment) for fallback matching
      const lastSegment = iter.path.split("\\").pop();
      if (lastSegment && lastSegment !== iter.path) {
        result[lastSegment] = {
          startDate: iter.startDate,
          endDate: iter.endDate
        };
        console.log(`[buildIterationDatesMap-added] Sprint-only: "${lastSegment}"`);
      }
    } else {
      console.log("[buildIterationDatesMap-skip]", {
        reason: iter.path && iter.startDate && iter.endDate ? "unknown" : "missing dates",
        path: iter.path,
        hasStart: !!iter.startDate,
        hasEnd: !!iter.endDate,
      });
    }
  }

  console.log("[buildIterationDatesMap-result] Final map keys:", Object.keys(result));
  console.log("[buildIterationDatesMap-result] Final map:", JSON.stringify(result, null, 2));
  return result;
}

/**
 * Determines if a work item should use iteration scheduling.
 * Returns true if item has a valid iteration path but missing explicit dates.
 */
export function shouldUseIterationScheduling(input: {
  hasExplicitStartDate: boolean;
  hasExplicitEndDate: boolean;
  iterationPath: IterationPath | null;
}): boolean {
  // Use iteration scheduling only if item lacks both explicit dates AND has iteration
  const missingBothDates = !input.hasExplicitStartDate && !input.hasExplicitEndDate;
  const hasIteration = input.iterationPath !== null;

  return missingBothDates && hasIteration;
}
