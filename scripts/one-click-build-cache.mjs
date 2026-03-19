export const BUILD_CACHE_REASONS = {
  GIT_UNAVAILABLE: "git-unavailable",
  INPUTS_CHANGED: "inputs-changed",
  MISSING_ARTIFACTS: "missing-artifacts",
  MISSING_MARKER: "missing-marker",
  UP_TO_DATE: "up-to-date"
};

export const BUILD_INPUT_PATHS = ["src", "scripts", "package.json", "package-lock.json", "tsconfig.json"];

export function createBuildStamp(commitHash, statusOutput = "") {
  const normalizedCommitHash = String(commitHash ?? "").trim();
  const normalizedStatusOutput = String(statusOutput ?? "").trimEnd();
  return JSON.stringify({
    commitHash: normalizedCommitHash,
    statusOutput: normalizedStatusOutput
  });
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
