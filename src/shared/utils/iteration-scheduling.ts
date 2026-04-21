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
  const shortNameOccurrences = new Map<string, number>();

  const usable = iterations.filter(
    (iter): iter is { path: string; startDate: string; endDate: string } =>
      Boolean(iter.path && iter.startDate && iter.endDate)
  );

  for (const iter of usable) {
    const shortName = iter.path.split("\\").pop();
    if (shortName && shortName !== iter.path) {
      shortNameOccurrences.set(shortName, (shortNameOccurrences.get(shortName) ?? 0) + 1);
    }
  }

  for (const iter of usable) {
    result[iter.path] = { startDate: iter.startDate, endDate: iter.endDate };

    const shortName = iter.path.split("\\").pop();
    if (shortName && shortName !== iter.path && shortNameOccurrences.get(shortName) === 1) {
      result[shortName] = { startDate: iter.startDate, endDate: iter.endDate };
    }
  }

  return result;
}
