import { describe, expect, it, vi } from "vitest";

import {
  GithubPackageVersionAdapter,
  GithubPackageVersionError
} from "./github-package-version.adapter.js";

describe("GithubPackageVersionAdapter", () => {
  it("loads the version from GitHub package.json", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { version: "1.9.0" }));
    const adapter = new GithubPackageVersionAdapter({ fetchImpl });

    await expect(adapter.loadLatestVersion()).resolves.toBe("1.9.0");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/tensor-five/AzureGanttOps/main/package.json",
      expect.objectContaining({
        method: "GET",
        headers: {
          accept: "application/json"
        },
        signal: expect.any(AbortSignal)
      })
    );
  });

  it("throws a controlled error for 404 and 500 responses", async () => {
    for (const status of [404, 500]) {
      const adapter = new GithubPackageVersionAdapter({
        fetchImpl: vi.fn(async () => jsonResponse(status, { message: "nope" }))
      });

      await expect(adapter.loadLatestVersion()).rejects.toMatchObject({
        name: "GithubPackageVersionError",
        reason: "http_error"
      });
    }
  });

  it("throws a controlled timeout error when the request is aborted", async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
    const adapter = new GithubPackageVersionAdapter({
      fetchImpl,
      timeoutMs: 1
    });

    await expect(adapter.loadLatestVersion()).rejects.toMatchObject({
      name: "GithubPackageVersionError",
      reason: "timeout"
    });
  });

  it("throws a controlled error for invalid JSON", async () => {
    const adapter = new GithubPackageVersionAdapter({
      fetchImpl: vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("bad json");
        }
      } as unknown as Response))
    });

    await expect(adapter.loadLatestVersion()).rejects.toMatchObject({
      name: "GithubPackageVersionError",
      reason: "request_failed"
    });
  });

  it("throws a controlled error when package.json has no version", async () => {
    const adapter = new GithubPackageVersionAdapter({
      fetchImpl: vi.fn(async () => jsonResponse(200, { name: "azure-ganttops" }))
    });

    await expect(adapter.loadLatestVersion()).rejects.toBeInstanceOf(GithubPackageVersionError);
    await expect(adapter.loadLatestVersion()).rejects.toMatchObject({
      reason: "invalid_response"
    });
  });
});

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
