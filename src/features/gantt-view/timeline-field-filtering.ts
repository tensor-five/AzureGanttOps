export const EMPTY_FIELD_FILTER_KEY = "__null__";
const TAG_FIELD_NAMES = new Set(["tag", "tags"]);
const TAG_SPLIT_DELIMITER = ";";

export type FilterValueToken = {
  key: string;
  label: string;
};

export function isTagFieldRef(fieldRef: string | null | undefined): boolean {
  const normalized = normalizeFieldRef(fieldRef);
  if (!normalized) {
    return false;
  }

  const parts = normalized.split(".");
  const leaf = parts[parts.length - 1] ?? normalized;
  return TAG_FIELD_NAMES.has(leaf.toLowerCase());
}

export function extractFilterValueTokens(
  fieldRef: string | null | undefined,
  value: string | number | null | undefined
): FilterValueToken[] {
  if (value === null || typeof value === "undefined") {
    return [toEmptyToken()];
  }

  if (!isTagFieldRef(fieldRef)) {
    const text = String(value).trim();
    return text.length > 0 ? [{ key: String(value), label: text }] : [toEmptyToken()];
  }

  const raw = String(value);
  const tokens = [...new Set(raw.split(TAG_SPLIT_DELIMITER).map((entry) => entry.trim()).filter((entry) => entry.length > 0))];
  if (tokens.length === 0) {
    return [toEmptyToken()];
  }

  return tokens.map((token) => ({ key: token, label: token }));
}

export function extractFilterMatchKeys(
  fieldRef: string | null | undefined,
  value: string | number | null | undefined
): string[] {
  const keys = extractFilterValueTokens(fieldRef, value).map((token) => token.key);
  if (value !== null && typeof value !== "undefined" && isTagFieldRef(fieldRef)) {
    keys.push(String(value));
  }

  return [...new Set(keys)];
}

function toEmptyToken(): FilterValueToken {
  return { key: EMPTY_FIELD_FILTER_KEY, label: "Empty" };
}

function normalizeFieldRef(fieldRef: string | null | undefined): string | null {
  if (typeof fieldRef !== "string") {
    return null;
  }

  const normalized = fieldRef.trim();
  return normalized.length > 0 ? normalized : null;
}
