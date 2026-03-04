const FLAT_QUERY_TYPE = "flat";

const UNSUPPORTED_TYPES = new Set(["tree", "onehop", "one-hop"]);

export function enforceFlatQueryShape(queryType: unknown): void {
  if (typeof queryType !== "string") {
    throw new Error("QRY_SHAPE_UNSUPPORTED");
  }

  const normalized = queryType.trim().toLowerCase();

  if (normalized === FLAT_QUERY_TYPE) {
    return;
  }

  if (UNSUPPORTED_TYPES.has(normalized) || normalized.length > 0) {
    throw new Error("QRY_SHAPE_UNSUPPORTED");
  }

  throw new Error("QRY_SHAPE_UNSUPPORTED");
}
