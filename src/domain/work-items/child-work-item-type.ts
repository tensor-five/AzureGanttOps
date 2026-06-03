export type WorkItemTypeOption = {
  name: string;
};

export function resolvePreferredChildWorkItemType(parentType: string | null | undefined): string | null {
  const normalized = normalizeWorkItemType(parentType);

  switch (normalized) {
    case "epic":
    case "epicppm":
      return "Feature";
    case "feature":
      return "User Story";
    case "user story":
      return "Task";
    default:
      return null;
  }
}

export function normalizeAvailableWorkItemTypes(
  availableTypes: readonly (string | WorkItemTypeOption)[] | null | undefined
): string[] {
  if (!availableTypes) {
    return [];
  }

  const seen = new Set<string>();
  const normalizedTypes: string[] = [];
  for (const candidate of availableTypes) {
    const rawName = typeof candidate === "string" ? candidate : candidate.name;
    const name = rawName.trim().replace(/\s+/g, " ");
    if (name.length === 0) {
      continue;
    }

    const key = normalizeWorkItemType(name);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalizedTypes.push(name);
  }

  return normalizedTypes.sort(compareWorkItemTypeNames);
}

export function resolveDefaultChildWorkItemType(
  parentType: string | null | undefined,
  availableTypes: readonly (string | WorkItemTypeOption)[] | null | undefined
): string | null {
  const sortedTypes = normalizeAvailableWorkItemTypes(availableTypes);
  if (sortedTypes.length === 0) {
    return null;
  }

  const preferredType = resolvePreferredChildWorkItemType(parentType);
  if (preferredType) {
    const matchedType = sortedTypes.find((availableType) => normalizeWorkItemType(availableType) === normalizeWorkItemType(preferredType));
    if (matchedType) {
      return matchedType;
    }
  }

  return sortedTypes[0] ?? null;
}

function normalizeWorkItemType(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
}

function compareWorkItemTypeNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" }) || a.localeCompare(b);
}
