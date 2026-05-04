import type { IngestionSnapshot, IngestionWorkItem } from "../dto/ingestion-snapshot.js";

const SPECIAL_KEYS = new Set<keyof IngestionWorkItem>(["id", "title"]);

export function extractAvailableFieldRefs(snapshot: IngestionSnapshot): string[] {
  const refs = new Set<string>();

  if (snapshot.workItems.some((item) => typeof item.id === "number")) {
    refs.add("System.Id");
  }
  if (snapshot.workItems.some((item) => typeof item.title === "string")) {
    refs.add("System.Title");
  }

  for (const item of snapshot.workItems) {
    for (const key of Object.keys(item)) {
      if (SPECIAL_KEYS.has(key as keyof IngestionWorkItem)) {
        continue;
      }
      const value = (item as Record<string, unknown>)[key];
      if (value === undefined) {
        continue;
      }
      refs.add(key);
    }
  }

  return [...refs];
}
