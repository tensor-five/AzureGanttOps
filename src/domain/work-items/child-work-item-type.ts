export type SupportedParentWorkItemType = "Epic" | "EpicPPM" | "Feature" | "User Story";
export type ChildWorkItemType = "Feature" | "User Story" | "Task";

export function resolveChildWorkItemType(parentType: string | null | undefined): ChildWorkItemType | null {
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

function normalizeWorkItemType(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
}
