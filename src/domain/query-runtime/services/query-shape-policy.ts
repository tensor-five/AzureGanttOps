export type QueryShape = "flat" | "tree" | "oneHop";

export function resolveQueryShape(queryType: unknown): QueryShape {
  if (typeof queryType !== "string") {
    throw new Error("QRY_SHAPE_UNSUPPORTED");
  }

  const normalized = queryType.trim().toLowerCase();

  if (normalized === "flat") {
    return "flat";
  }

  if (normalized === "tree") {
    return "tree";
  }

  if (normalized === "onehop" || normalized === "one-hop") {
    return "oneHop";
  }

  throw new Error("QRY_SHAPE_UNSUPPORTED");
}