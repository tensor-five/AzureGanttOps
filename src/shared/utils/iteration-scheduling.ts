export type IterationPath = {
  projectName: string;
  iterationPath: string;
};

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

export function buildIterationDatesMap(
  iterations: Array<{ path: string; startDate: string | null; endDate: string | null }>
): Record<string, { startDate: string; endDate: string }> {
  const result: Record<string, { startDate: string; endDate: string }> = {};

  for (const iter of iterations) {
    if (!iter.path || !iter.startDate || !iter.endDate) {
      continue;
    }

    result[iter.path] = {
      startDate: iter.startDate,
      endDate: iter.endDate
    };

    const lastSegment = iter.path.split("\\").pop();
    if (lastSegment && lastSegment !== iter.path) {
      result[lastSegment] = {
        startDate: iter.startDate,
        endDate: iter.endDate
      };
    }
  }

  return result;
}
