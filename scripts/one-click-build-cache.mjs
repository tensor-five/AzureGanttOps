import { createHash } from "node:crypto";

export const BUILD_CACHE_REASONS = {
  GIT_UNAVAILABLE: "git-unavailable",
  INPUTS_CHANGED: "inputs-changed",
  MISSING_ARTIFACTS: "missing-artifacts",
  MISSING_MARKER: "missing-marker",
  UP_TO_DATE: "up-to-date"
};

export const BUILD_INPUT_PATHS = ["src", "scripts", "package.json", "package-lock.json", "tsconfig.json"];
export const DEPENDENCY_INPUT_PATHS = ["package.json", "package-lock.json"];
export const DEPENDENCY_CACHE_REASONS = {
  INPUTS_CHANGED: "inputs-changed",
  INPUTS_UNAVAILABLE: "inputs-unavailable",
  MISSING_MARKER: "missing-marker",
  MISSING_NODE_MODULES: "missing-node-modules",
  UP_TO_DATE: "up-to-date"
};

export function createBuildStamp(commitHash, statusOutput = "") {
  const normalizedCommitHash = String(commitHash ?? "").trim();
  const normalizedStatusOutput = String(statusOutput ?? "").trimEnd();
  return JSON.stringify({
    commitHash: normalizedCommitHash,
    statusOutput: normalizedStatusOutput
  });
}

export function createDependencyStamp(inputs = []) {
  const hash = createHash("sha256");
  for (const input of inputs) {
    hash.update(String(input.path ?? ""));
    hash.update("\0");
    hash.update(String(input.content ?? ""));
    hash.update("\0");
  }

  return JSON.stringify({
    inputHash: hash.digest("hex")
  });
}

export function determineDependencyInstallAction({
  hasNodeModules,
  currentDependencyStamp,
  lastDependencyStamp
}) {
  if (!hasNodeModules) {
    return { shouldInstall: true, reason: DEPENDENCY_CACHE_REASONS.MISSING_NODE_MODULES };
  }

  if (!currentDependencyStamp) {
    return { shouldInstall: true, reason: DEPENDENCY_CACHE_REASONS.INPUTS_UNAVAILABLE };
  }

  if (!lastDependencyStamp) {
    return { shouldInstall: true, reason: DEPENDENCY_CACHE_REASONS.MISSING_MARKER };
  }

  if (currentDependencyStamp !== lastDependencyStamp) {
    return { shouldInstall: true, reason: DEPENDENCY_CACHE_REASONS.INPUTS_CHANGED };
  }

  return { shouldInstall: false, reason: DEPENDENCY_CACHE_REASONS.UP_TO_DATE };
}

export function determineBuildAction({
  hasServerArtifact,
  hasUiArtifact,
  currentBuildStamp,
  lastBuildStamp
}) {
  if (!hasServerArtifact || !hasUiArtifact) {
    return { shouldBuild: true, reason: BUILD_CACHE_REASONS.MISSING_ARTIFACTS };
  }

  if (!currentBuildStamp) {
    return { shouldBuild: false, reason: BUILD_CACHE_REASONS.GIT_UNAVAILABLE };
  }

  if (!lastBuildStamp) {
    return { shouldBuild: true, reason: BUILD_CACHE_REASONS.MISSING_MARKER };
  }

  if (currentBuildStamp !== lastBuildStamp) {
    return { shouldBuild: true, reason: BUILD_CACHE_REASONS.INPUTS_CHANGED };
  }

  return { shouldBuild: false, reason: BUILD_CACHE_REASONS.UP_TO_DATE };
}

export function getCommitHashFromBuildStamp(buildStamp) {
  if (!buildStamp) {
    return "";
  }

  try {
    const parsed = JSON.parse(buildStamp);
    return typeof parsed.commitHash === "string" ? parsed.commitHash : "";
  } catch {
    return "";
  }
}
