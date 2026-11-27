export type VersionComparison = "greater" | "equal" | "less";

type ParsedSemver = {
  major: number;
  minor: number;
  patch: number;
};

const SIMPLE_SEMVER_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/i;

export function compareSimpleSemver(left: string, right: string): VersionComparison | null {
  const parsedLeft = parseSimpleSemver(left);
  const parsedRight = parseSimpleSemver(right);

  if (!parsedLeft || !parsedRight) {
    return null;
  }

  for (const key of ["major", "minor", "patch"] as const) {
    if (parsedLeft[key] > parsedRight[key]) {
      return "greater";
    }

    if (parsedLeft[key] < parsedRight[key]) {
      return "less";
    }
  }

  return "equal";
}

export function parseSimpleSemver(version: string): ParsedSemver | null {
  const match = version.trim().match(SIMPLE_SEMVER_PATTERN);
  if (!match) {
    return null;
  }

  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patch = Number.parseInt(match[3], 10);

  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) {
    return null;
  }

  return {
    major,
    minor,
    patch
  };
}
