import { describe, expect, it, vi } from "vitest";

import type { AppVersionSourcePort } from "../ports/app-version-source.port.js";
import { CheckAppUpdateUseCase } from "./check-app-update.use-case.js";

describe("CheckAppUpdateUseCase", () => {
  it("reports update_available when the source version is greater", async () => {
    const source = createVersionSource("1.9.0");
    const useCase = createUseCase({ currentVersion: "1.8.3", source });

    await expect(useCase.execute()).resolves.toMatchObject({
      status: "update_available",
      currentVersion: "1.8.3",
      latestVersion: "1.9.0",
      checkedAt: "2026-06-27T10:00:00.000Z",
      source: "github"
    });
  });

  it("reports current when the source version is equal or lower", async () => {
    const equal = createUseCase({
      currentVersion: "1.8.3",
      source: createVersionSource("v1.8.3")
    });
    const lower = createUseCase({
      currentVersion: "1.8.3",
      source: createVersionSource("1.8.2")
    });

    await expect(equal.execute()).resolves.toMatchObject({
      status: "current",
      latestVersion: "v1.8.3"
    });
    await expect(lower.execute()).resolves.toMatchObject({
      status: "current",
      latestVersion: "1.8.2"
    });
  });

  it("reports unavailable when the local version is malformed", async () => {
    const source = createVersionSource("1.9.0");
    const useCase = createUseCase({ currentVersion: "dev", source });

    await expect(useCase.execute()).resolves.toMatchObject({
      status: "unavailable",
      currentVersion: "dev",
      reason: "current_version_malformed"
    });
    expect(source.loadLatestVersion).not.toHaveBeenCalled();
  });

  it("reports unavailable when the source returns a malformed version", async () => {
    const useCase = createUseCase({
      currentVersion: "1.8.3",
      source: createVersionSource("main")
    });

    await expect(useCase.execute()).resolves.toMatchObject({
      status: "unavailable",
      latestVersion: "main",
      reason: "latest_version_malformed"
    });
  });

  it("reports unavailable when the source fails", async () => {
    const useCase = createUseCase({
      currentVersion: "1.8.3",
      source: createVersionSource(new Error("network down"))
    });

    await expect(useCase.execute()).resolves.toMatchObject({
      status: "unavailable",
      reason: "version_source_failed"
    });
  });

  it("loads the source again for sequential current and update checks", async () => {
    const source = createVersionSourceSequence("1.8.3", "1.9.0");
    const useCase = createUseCase({
      currentVersion: "1.8.3",
      source
    });

    await expect(useCase.execute()).resolves.toMatchObject({
      status: "current",
      latestVersion: "1.8.3"
    });
    await expect(useCase.execute()).resolves.toMatchObject({
      status: "update_available",
      latestVersion: "1.9.0"
    });

    expect(source.loadLatestVersion).toHaveBeenCalledTimes(2);
  });

  it("loads the source again for sequential unavailable checks", async () => {
    const source = createVersionSourceSequence(
      new Error("offline"),
      new Error("still offline")
    );
    const useCase = createUseCase({
      currentVersion: "1.8.3",
      source
    });

    await expect(useCase.execute()).resolves.toMatchObject({
      status: "unavailable",
      reason: "version_source_failed"
    });
    await expect(useCase.execute()).resolves.toMatchObject({
      status: "unavailable",
      reason: "version_source_failed"
    });

    expect(source.loadLatestVersion).toHaveBeenCalledTimes(2);
  });

  it("deduplicates parallel checks with an in-flight promise", async () => {
    const deferred = createDeferred<string>();
    const source = createVersionSource(deferred.promise);
    const useCase = createUseCase({ currentVersion: "1.8.3", source });

    const first = useCase.execute();
    const second = useCase.execute();

    deferred.resolve("1.9.0");

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ status: "update_available" }),
      expect.objectContaining({ status: "update_available" })
    ]);
    expect(source.loadLatestVersion).toHaveBeenCalledTimes(1);
  });
});

function createUseCase(params: {
  currentVersion: string;
  source: AppVersionSourcePort;
  now?: () => Date;
}): CheckAppUpdateUseCase {
  return new CheckAppUpdateUseCase({
    currentVersion: params.currentVersion,
    versionSource: params.source,
    now: params.now ?? (() => new Date("2026-06-27T10:00:00.000Z"))
  });
}

function createVersionSource(version: string | Promise<string> | Error): AppVersionSourcePort & {
  loadLatestVersion: ReturnType<typeof vi.fn<() => Promise<string>>>;
} {
  return {
    source: "github",
    loadLatestVersion: vi.fn(async () => {
      if (version instanceof Error) {
        throw version;
      }

      return version;
    })
  };
}

function createVersionSourceSequence(
  ...versions: Array<string | Error>
): AppVersionSourcePort & {
  loadLatestVersion: ReturnType<typeof vi.fn<() => Promise<string>>>;
} {
  return {
    source: "github",
    loadLatestVersion: vi.fn(async () => {
      const version = versions.shift();
      if (version instanceof Error) {
        throw version;
      }

      return version ?? "";
    })
  };
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return {
    promise,
    resolve
  };
}
