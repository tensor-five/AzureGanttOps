import { describe, expect, it } from "vitest";

import {
  BUILD_INPUT_PATHS,
  BUILD_CACHE_REASONS,
  DEPENDENCY_CACHE_REASONS,
  DEPENDENCY_INPUT_PATHS,
  createBuildStamp,
  createDependencyStamp,
  determineDependencyInstallAction,
  determineBuildAction,
  getCommitHashFromBuildStamp
} from "./one-click-build-cache.mjs";

describe("BUILD_INPUT_PATHS", () => {
  it("tracks the relevant build inputs", () => {
    expect(BUILD_INPUT_PATHS).toEqual([
      "src",
      "scripts",
      "package.json",
      "package-lock.json",
      "tsconfig.json"
    ]);
  });
});

describe("DEPENDENCY_INPUT_PATHS", () => {
  it("tracks npm dependency inputs", () => {
    expect(DEPENDENCY_INPUT_PATHS).toEqual(["package.json", "package-lock.json"]);
  });
});

describe("createBuildStamp", () => {
  it("normalizes commit and status output for stable comparisons", () => {
    expect(createBuildStamp(" abc123 \n", " M src/app.ts\n?? src/new.ts\n\n")).toBe(
      JSON.stringify({
        commitHash: "abc123",
        statusOutput: " M src/app.ts\n?? src/new.ts"
      })
    );
  });
});

describe("createDependencyStamp", () => {
  it("creates a stable dependency stamp from package inputs", () => {
    const inputs = [
      { path: "package.json", content: "{\"dependencies\":{}}" },
      { path: "package-lock.json", content: "{\"lockfileVersion\":3}" }
    ];

    expect(createDependencyStamp(inputs)).toBe(createDependencyStamp(inputs));
    expect(createDependencyStamp(inputs)).not.toBe(
      createDependencyStamp([
        ...inputs.slice(0, 1),
        { path: "package-lock.json", content: "{\"lockfileVersion\":4}" }
      ])
    );
  });
});

describe("determineDependencyInstallAction", () => {
  it("installs when node_modules is missing", () => {
    expect(
      determineDependencyInstallAction({
        hasNodeModules: false,
        currentDependencyStamp: createDependencyStamp([]),
        lastDependencyStamp: createDependencyStamp([])
      })
    ).toEqual({ shouldInstall: true, reason: DEPENDENCY_CACHE_REASONS.MISSING_NODE_MODULES });
  });

  it("installs when dependency inputs cannot be read", () => {
    expect(
      determineDependencyInstallAction({
        hasNodeModules: true,
        currentDependencyStamp: "",
        lastDependencyStamp: createDependencyStamp([])
      })
    ).toEqual({ shouldInstall: true, reason: DEPENDENCY_CACHE_REASONS.INPUTS_UNAVAILABLE });
  });

  it("installs when the dependency marker is missing", () => {
    expect(
      determineDependencyInstallAction({
        hasNodeModules: true,
        currentDependencyStamp: createDependencyStamp([]),
        lastDependencyStamp: ""
      })
    ).toEqual({ shouldInstall: true, reason: DEPENDENCY_CACHE_REASONS.MISSING_MARKER });
  });

  it("installs when package inputs changed", () => {
    expect(
      determineDependencyInstallAction({
        hasNodeModules: true,
        currentDependencyStamp: createDependencyStamp([{ path: "package-lock.json", content: "new" }]),
        lastDependencyStamp: createDependencyStamp([{ path: "package-lock.json", content: "old" }])
      })
    ).toEqual({ shouldInstall: true, reason: DEPENDENCY_CACHE_REASONS.INPUTS_CHANGED });
  });

  it("skips install when dependency inputs match the marker", () => {
    const stamp = createDependencyStamp([{ path: "package-lock.json", content: "same" }]);

    expect(
      determineDependencyInstallAction({
        hasNodeModules: true,
        currentDependencyStamp: stamp,
        lastDependencyStamp: stamp
      })
    ).toEqual({ shouldInstall: false, reason: DEPENDENCY_CACHE_REASONS.UP_TO_DATE });
  });
});

describe("determineBuildAction", () => {
  it("builds when artifacts are missing", () => {
    expect(
      determineBuildAction({
        hasServerArtifact: false,
        hasUiArtifact: true,
        currentBuildStamp: createBuildStamp("abc123"),
        lastBuildStamp: createBuildStamp("abc123")
      })
    ).toEqual({ shouldBuild: true, reason: BUILD_CACHE_REASONS.MISSING_ARTIFACTS });
  });

  it("builds when the marker file is missing", () => {
    expect(
      determineBuildAction({
        hasServerArtifact: true,
        hasUiArtifact: true,
        currentBuildStamp: createBuildStamp("abc123"),
        lastBuildStamp: ""
      })
    ).toEqual({ shouldBuild: true, reason: BUILD_CACHE_REASONS.MISSING_MARKER });
  });

  it("skips the build when git metadata is unavailable but artifacts exist", () => {
    expect(
      determineBuildAction({
        hasServerArtifact: true,
        hasUiArtifact: true,
        currentBuildStamp: "",
        lastBuildStamp: createBuildStamp("abc123")
      })
    ).toEqual({ shouldBuild: false, reason: BUILD_CACHE_REASONS.GIT_UNAVAILABLE });
  });

  it("skips the build when commit and working tree state match the last build", () => {
    const buildStamp = createBuildStamp("abc123", " M src/app.ts");

    expect(
      determineBuildAction({
        hasServerArtifact: true,
        hasUiArtifact: true,
        currentBuildStamp: buildStamp,
        lastBuildStamp: buildStamp
      })
    ).toEqual({ shouldBuild: false, reason: BUILD_CACHE_REASONS.UP_TO_DATE });
  });

  it("rebuilds when the working tree changed even if HEAD stayed the same", () => {
    expect(
      determineBuildAction({
        hasServerArtifact: true,
        hasUiArtifact: true,
        currentBuildStamp: createBuildStamp("abc123", " M src/app.ts"),
        lastBuildStamp: createBuildStamp("abc123")
      })
    ).toEqual({ shouldBuild: true, reason: BUILD_CACHE_REASONS.INPUTS_CHANGED });
  });
});

describe("getCommitHashFromBuildStamp", () => {
  it("returns the commit hash from a serialized build stamp", () => {
    expect(getCommitHashFromBuildStamp(createBuildStamp("abc123", " M src/app.ts"))).toBe("abc123");
  });

  it("returns an empty string for invalid input", () => {
    expect(getCommitHashFromBuildStamp("{not-json")).toBe("");
  });
});
