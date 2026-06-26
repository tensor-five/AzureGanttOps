import { afterEach, describe, expect, it, vi } from "vitest";

import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createHttpServer } from "./http-server.js";
import {
  PWA_ICON_192_PATH,
  PWA_ICON_512_PATH,
  PWA_MANIFEST_PATH,
  PWA_SERVICE_WORKER_PATH,
  PWA_THEME_COLOR
} from "./pwa-constants.js";
import { PWA_SERVICE_WORKER_SOURCE } from "./pwa-assets.js";
import type { CliCommandRunner } from "../../adapters/azure-devops/auth/azure-cli-preflight.adapter.js";
import { LOCAL_CONFIG_RESET_CONFIRMATION } from "../../application/ports/local-config-reset.port.js";
import { APP_VERSION, CHANGELOG_PATH } from "../../shared/project-meta/project-meta.js";

type StartedServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

describe("createHttpServer", () => {
  const expectedLocalOnlyCsp =
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'; " +
    "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; " +
    "connect-src 'self'; manifest-src 'self'";
  const tempDirs: string[] = [];
  const readyAuthPreflightRunner: CliCommandRunner = {
    run: async (command) => {
      if (command.includes("--version")) {
        return {
          stdout: "azure-cli 2.0",
          stderr: "",
          exitCode: 0
        };
      }

      if (command.includes("extension show --name azure-devops")) {
        return {
          stdout: "{}",
          stderr: "",
          exitCode: 0
        };
      }

      if (command.includes("account show")) {
        return {
          stdout: "{}",
          stderr: "",
          exitCode: 0
        };
      }

      if (command.includes("devops configure --list")) {
        return {
          stdout: "organization = contoso\nproject = delivery",
          stderr: "",
          exitCode: 0
        };
      }

      return {
        stdout: "",
        stderr: `Unexpected command: ${command}`,
        exitCode: 1
      };
    }
  };

  afterEach(async () => {
    await Promise.all(
      tempDirs.map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
      })
    );
    tempDirs.length = 0;
  });

  it("returns HTML shell for GET /", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/`);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(text).toContain('<div id="app"></div>');
      expect(text).toMatch(/<meta name="ado-write-enabled" content="[01]" \/>/);
      expect(text).toContain(`<meta name="theme-color" content="${PWA_THEME_COLOR}" />`);
      expect(text).toContain('<meta name="mobile-web-app-capable" content="yes" />');
      expect(text).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
      expect(text).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="default" />');
      expect(text).toContain('<meta name="apple-mobile-web-app-title" content="AzureGanttOps" />');
      expect(text).toContain(`<link rel="manifest" href="${PWA_MANIFEST_PATH}" />`);
      expect(text).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
      expect(text).toContain('<link rel="icon" href="/favicon.ico" sizes="any" />');
      expect(text).toContain(`<link rel="icon" type="image/png" sizes="192x192" href="${PWA_ICON_192_PATH}" />`);
      expect(text).toContain(`<link rel="apple-touch-icon" href="${PWA_ICON_192_PATH}" />`);
      expect(text).toContain('/dist/src/app/bootstrap/local-ui-entry.browser.css');
      expect(text).toContain('/dist/src/app/bootstrap/local-ui-entry.browser.js');
    } finally {
      await server.close();
    }
  });

  it("serves a local-only CSP without Fontshare allowances", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/`);
      const csp = response.headers.get("content-security-policy");

      expect(csp).toBe(expectedLocalOnlyCsp);
      expect(csp).not.toContain("api.fontshare.com");
      expect(csp).not.toContain("cdn.fontshare.com");
    } finally {
      await server.close();
    }
  });

  it("serves favicon for GET /favicon.svg", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/favicon.svg`);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/svg+xml");
      expect(text).toContain("<svg");
    } finally {
      await server.close();
    }
  });

  it("serves favicon for GET /favicon.ico", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/favicon.ico`);
      const body = await response.arrayBuffer();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/x-icon");
      expect(body.byteLength).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  });

  it("serves PWA manifest for GET /manifest.webmanifest", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}${PWA_MANIFEST_PATH}`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/manifest+json; charset=utf-8");
      expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
      expect(response.headers.get("content-security-policy")).toBe(expectedLocalOnlyCsp);
      expect(body).toMatchObject({
        name: "AzureGanttOps",
        short_name: "GanttOps",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: PWA_THEME_COLOR,
        background_color: "#ffffff"
      });
      expect(body.icons).toEqual([
        {
          src: PWA_ICON_192_PATH,
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable"
        },
        {
          src: PWA_ICON_512_PATH,
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable"
        }
      ]);
    } finally {
      await server.close();
    }
  });

  it("serves PWA icons as cacheable PNGs", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      for (const icon of [
        { path: PWA_ICON_192_PATH, size: 192 },
        { path: PWA_ICON_512_PATH, size: 512 }
      ]) {
        const response = await fetch(`${server.baseUrl}${icon.path}`);
        const body = Buffer.from(await response.arrayBuffer());

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("image/png");
        expect(response.headers.get("cache-control")).toBe("public, max-age=604800, immutable");
        expect(readPngDimensions(body)).toEqual({ width: icon.size, height: icon.size });
      }
    } finally {
      await server.close();
    }
  });

  it("serves service worker without HTTP caching", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}${PWA_SERVICE_WORKER_PATH}`);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(text).toBe(PWA_SERVICE_WORKER_SOURCE);
    } finally {
      await server.close();
    }
  });

  it("serves changelog markdown without HTTP caching", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}${CHANGELOG_PATH}`);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-security-policy")).toBe(expectedLocalOnlyCsp);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(text).toContain(`## [${APP_VERSION}] - 2026-06-26`);
    } finally {
      await server.close();
    }
  });

  it("keeps GET /health unchanged", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/health`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(body).toEqual({ status: "ok" });
    } finally {
      await server.close();
    }
  });

  it("keeps POST /phase2/query-intake invalid input behavior unchanged", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/phase2/query-intake`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ queryInput: 123 })
      });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(body).toEqual({
        code: "INVALID_INPUT",
        message: "Provide queryInput as a string."
      });
    } finally {
      await server.close();
    }
  });

  it("returns JSON NOT_FOUND for unknown routes", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/unknown`);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(body).toEqual({
        code: "NOT_FOUND",
        message: "Route not found."
      });
    } finally {
      await server.close();
    }
  });

  it("returns ado communication logs with sequence and cursor", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get: async (url) => ({
          status: 200,
          json: {
            value: [],
            echo: `${url}&token=plain_token_value`
          },
          headers: {}
        })
      }
    });

    const originalPath = process.env.PATH;

    try {
      process.env.PATH = `${path.dirname(fixture.azCliShimPath)}:${originalPath ?? ""}`;

      await fetch(`${server.baseUrl}/phase2/query-intake`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ queryInput: "11111111-1111-4111-8111-111111111111" })
      });

      const response = await fetch(`${server.baseUrl}/phase2/ado-comm-logs`);
      const body = (await response.json()) as {
        entries: Array<{
          seq: number;
          direction: "request" | "response";
          url: string;
          preview: string;
        }>;
        nextSeq: number;
      };

      expect(response.status).toBe(200);
      expect(Array.isArray(body.entries)).toBe(true);
      expect(body.entries.length).toBeGreaterThanOrEqual(2);
      expect(body.entries[0]?.seq).toBe(1);
      expect(body.entries[1]?.seq).toBe(2);
      expect(body.entries.every((entry, index) => index === 0 || entry.seq > body.entries[index - 1]!.seq)).toBe(true);
      expect(body.entries.some((entry) => entry.direction === "request")).toBe(true);
      expect(body.entries.some((entry) => entry.direction === "response")).toBe(true);
      expect(body.nextSeq).toBeGreaterThanOrEqual(2);
      expect(body.entries.every((entry) => !entry.url.includes("plain_token_value"))).toBe(true);
      const responseEntry = body.entries.find((entry) => entry.direction === "response");
      expect(responseEntry).toBeDefined();
      expect(responseEntry?.preview).not.toContain("plain_token_value");
      expect(responseEntry?.preview).toContain("[REDACTED]");
    } finally {
      process.env.PATH = originalPath;
      await server.close();
    }
  });

  it("redacts bearer/jwt and token-like key values from ado communication previews", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get: async () => ({
          status: 200,
          json: {
            authorization: "Bearer abcdefghijklmnopqrstuvwxyz123456",
            access_token: "tok_very_secret_value_123456",
            nested: {
              jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.signaturepart"
            }
          },
          headers: {}
        })
      }
    });

    const originalPath = process.env.PATH;

    try {
      process.env.PATH = `${path.dirname(fixture.azCliShimPath)}:${originalPath ?? ""}`;

      await fetch(`${server.baseUrl}/phase2/query-intake`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ queryInput: "11111111-1111-4111-8111-111111111114" })
      });

      const response = await fetch(`${server.baseUrl}/phase2/ado-comm-logs`);
      const body = (await response.json()) as {
        entries: Array<{
          direction: "request" | "response";
          preview: string;
        }>;
      };

      const responseEntry = body.entries.find((entry) => entry.direction === "response");
      expect(responseEntry).toBeDefined();
      expect(responseEntry?.preview).toContain("[REDACTED]");
      expect(responseEntry?.preview).not.toContain("tok_very_secret_value_123456");
      expect(responseEntry?.preview).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
      expect(responseEntry?.preview).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    } finally {
      process.env.PATH = originalPath;
      await server.close();
    }
  });

  it("returns only newer ado communication logs after cursor", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    const originalPath = process.env.PATH;

    try {
      process.env.PATH = `${path.dirname(fixture.azCliShimPath)}:${originalPath ?? ""}`;

      await fetch(`${server.baseUrl}/phase2/query-intake`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ queryInput: "11111111-1111-4111-8111-111111111112" })
      });

      const first = (await (await fetch(`${server.baseUrl}/phase2/ado-comm-logs`)).json()) as {
        entries: Array<{ seq: number }>;
        nextSeq: number;
      };

      await fetch(`${server.baseUrl}/phase2/query-intake`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ queryInput: "11111111-1111-4111-8111-111111111113" })
      });

      const second = (await (
        await fetch(`${server.baseUrl}/phase2/ado-comm-logs?afterSeq=${first.nextSeq}`)
      ).json()) as {
        entries: Array<{ seq: number }>;
        nextSeq: number;
      };

      expect(second.entries.length).toBeGreaterThanOrEqual(2);
      expect(second.entries.every((entry) => entry.seq > first.nextSeq)).toBe(true);
      expect(second.nextSeq).toBeGreaterThan(first.nextSeq);
    } finally {
      process.env.PATH = originalPath;
      await server.close();
    }
  });

  it("enforces ado communication log limit cap", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      authPreflightRunner: readyAuthPreflightRunner
    });

    try {
      for (let index = 0; index < 120; index += 1) {
        await fetch(`${server.baseUrl}/phase2/query-intake`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ queryInput: `11111111-1111-4111-8111-${(index + 1000).toString().padStart(12, "0")}` })
        });
      }

      const capped = (await (
        await fetch(`${server.baseUrl}/phase2/ado-comm-logs?afterSeq=0&limit=9999`)
      ).json()) as {
        entries: Array<{ seq: number }>;
      };

      expect(capped.entries.length).toBeLessThanOrEqual(200);
    } finally {
      await server.close();
    }
  });

  it("starts Azure CLI login via POST /phase2/az-login", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      azLoginRunner: async () => ({
        message: "Azure CLI login completed. Retry query intake."
      })
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/az-login`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        }
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        status: "OK",
        message: "Azure CLI login completed. Retry query intake."
      });
    } finally {
      await server.close();
    }
  });

  it("rejects manual Azure CLI path via POST /phase2/az-cli-path", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/az-cli-path`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          path: "C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd"
        })
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toEqual({
        code: "FORBIDDEN",
        message: "Manual Azure CLI path override is disabled for security reasons."
      });
    } finally {
      await server.close();
      delete process.env.ADO_AZ_CLI_PATH;
    }
  });

  it("auto-detects Azure CLI path via POST /phase2/az-cli-path with empty input", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      azCliPathResolver: async () => "C:\\Tools\\AzureCLI\\az.cmd"
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/az-cli-path`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          path: ""
        })
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        status: "OK",
        path: "C:\\Tools\\AzureCLI\\az.cmd"
      });
    } finally {
      await server.close();
      delete process.env.ADO_AZ_CLI_PATH;
    }
  });

  it("rejects az-login without csrf token", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/phase2/az-login`, {
        method: "POST",
        headers: {
          accept: "application/json"
        }
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toEqual({
        code: "CSRF_INVALID",
        message: "Missing or invalid CSRF protection."
      });
    } finally {
      await server.close();
    }
  });

  it("rejects write routes without csrf token", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const requests: Array<{ path: string; body: Record<string, unknown> }> = [
        {
          path: "/phase2/work-item-schedule-adopt",
          body: {
            targetWorkItemId: 11,
            startDate: "2026-03-01",
            endDate: "2026-03-03"
          }
        },
        {
          path: "/phase2/dependency-link",
          body: {
            predecessorWorkItemId: 10,
            successorWorkItemId: 11,
            action: "add"
          }
        },
        {
          path: "/phase2/work-item-details-update",
          body: {
            targetWorkItemId: 11,
            title: "Item",
            descriptionHtml: "<p>Safe</p>",
            state: "Active"
          }
        },
        {
          path: "/phase2/work-item-state-update",
          body: {
            targetWorkItemId: 11,
            state: "Active"
          }
        },
        {
          path: "/phase2/work-item-duplicate",
          body: {
            sourceWorkItemId: 11
          }
        },
        {
          path: "/phase2/work-item-child-create",
          body: {
            parentWorkItemId: 11
          }
        },
        {
          path: "/phase2/local-config-reset",
          body: {
            confirmation: LOCAL_CONFIG_RESET_CONFIRMATION
          }
        }
      ];

      for (const request of requests) {
        const response = await fetch(`${server.baseUrl}${request.path}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json"
          },
          body: JSON.stringify(request.body)
        });
        const payload = await response.json();
        expect(response.status).toBe(403);
        expect(payload).toEqual({
          code: "CSRF_INVALID",
          message: "Missing or invalid CSRF protection."
        });
      }
    } finally {
      await server.close();
    }
  });

  it("rejects user-preferences POST without csrf token", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const response = await fetch(`${server.baseUrl}/phase2/user-preferences`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify({
          preferences: {
            themeMode: "dark"
          }
        })
      });
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body).toEqual({
        code: "CSRF_INVALID",
        message: "Missing or invalid CSRF protection."
      });
    } finally {
      await server.close();
    }
  });

  it("embeds a hex csrf token in root HTML", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath
    });

    try {
      const first = await fetchCsrfToken(server.baseUrl);
      const second = await fetchCsrfToken(server.baseUrl);

      expect(first).toMatch(/^[a-f0-9]{64}$/);
      expect(second).toMatch(/^[a-f0-9]{64}$/);
      expect(first).toBe(second);
    } finally {
      await server.close();
    }
  });

  it("updates only System.State via /phase2/work-item-state-update", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const previousWriteEnabled = process.env.ADO_WRITE_ENABLED;
    process.env.ADO_WRITE_ENABLED = "1";
    const patch = async (url: string, body: unknown) => ({
      status: 200,
      json: { url, body },
      headers: {}
    });
    const calls: Array<{ url: string; body: unknown }> = [];
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get: async () => ({ status: 200, json: { value: [] }, headers: {} }),
        patch: async (url, body) => {
          calls.push({ url, body });
          return patch(url, body);
        }
      }
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/work-item-state-update`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          targetWorkItemId: 42,
          state: "Closed"
        })
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.commandKind).toBe("WORK_ITEM_PATCH");
      expect(calls).toEqual([
        {
          url: "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/42?api-version=7.1",
          body: [{ op: "add", path: "/fields/System.State", value: "Closed" }]
        }
      ]);
    } finally {
      if (previousWriteEnabled === undefined) {
        delete process.env.ADO_WRITE_ENABLED;
      } else {
        process.env.ADO_WRITE_ENABLED = previousWriteEnabled;
      }
      await server.close();
    }
  });

  it("creates dependency links via /phase2/dependency-link", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const previousWriteEnabled = process.env.ADO_WRITE_ENABLED;
    process.env.ADO_WRITE_ENABLED = "1";
    const get = vi.fn(async () => ({
      status: 200,
      json: {
        relations: []
      },
      headers: {}
    }));
    const patch = vi.fn(async () => ({
      status: 200,
      json: {},
      headers: {}
    }));
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get,
        patch
      }
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/dependency-link`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          predecessorWorkItemId: 1001,
          successorWorkItemId: 1002,
          action: "add"
        })
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        commandKind: "DEPENDENCY_LINK",
        mode: "EXECUTED",
        operationCount: 1
      });
      expect(get).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/1001?$expand=relations&api-version=7.1"
      );
      expect(patch).toHaveBeenCalledWith(
        "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/1001?api-version=7.1",
        [
          {
            op: "add",
            path: "/relations/-",
            value: {
              rel: "System.LinkTypes.Dependency-Forward",
              url: "https://dev.azure.com/contoso/_apis/wit/workItems/1002"
            }
          }
        ],
        {
          "content-type": "application/json-patch+json",
          accept: "application/json"
        }
      );
    } finally {
      if (previousWriteEnabled === undefined) {
        delete process.env.ADO_WRITE_ENABLED;
      } else {
        process.env.ADO_WRITE_ENABLED = previousWriteEnabled;
      }
      await server.close();
    }
  });

  it("forwards Azure dependency link validation details", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const previousWriteEnabled = process.env.ADO_WRITE_ENABLED;
    process.env.ADO_WRITE_ENABLED = "1";
    const get = vi.fn(async () => ({
      status: 200,
      json: {
        relations: []
      },
      headers: {}
    }));
    const patch = vi.fn(async () => ({
      status: 400,
      json: {
        message: "VS403630: The relation URL is invalid."
      },
      headers: {}
    }));
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get,
        patch
      }
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/dependency-link`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          predecessorWorkItemId: 1001,
          successorWorkItemId: 1002,
          action: "add"
        })
      });
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        code: "WRITE_FAILED",
        message: "DEPENDENCY_LINK_FAILED: VS403630: The relation URL is invalid."
      });
    } finally {
      if (previousWriteEnabled === undefined) {
        delete process.env.ADO_WRITE_ENABLED;
      } else {
        process.env.ADO_WRITE_ENABLED = previousWriteEnabled;
      }
      await server.close();
    }
  });

  it("duplicates work items via /phase2/work-item-duplicate", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const previousWriteEnabled = process.env.ADO_WRITE_ENABLED;
    process.env.ADO_WRITE_ENABLED = "1";
    const postCalls: Array<{ url: string; body: unknown }> = [];
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get: async () => ({
          status: 200,
          json: {
            fields: {
              "System.Title": "Original",
              "System.WorkItemType": "Task",
              "System.Tags": "alpha",
              "Microsoft.VSTS.Scheduling.StartDate": "2026-01-01T00:00:00.000Z",
              "Custom.StartDate2": "2026-03-01T00:00:00.000Z",
              "Custom.TargetDate2": "2026-03-03T00:00:00.000Z"
            },
            relations: [
              {
                rel: "System.LinkTypes.Hierarchy-Reverse",
                url: "https://dev.azure.com/contoso/delivery/_apis/wit/workItems/7"
              }
            ]
          },
          headers: {}
        }),
        patch: async () => ({ status: 200, json: {}, headers: {} }),
        post: async (url, body) => {
          postCalls.push({ url, body });
          return { status: 200, json: { id: 99 }, headers: {} };
        }
      }
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/work-item-duplicate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          sourceWorkItemId: 42,
          scheduleFieldRefs: {
            start: "Custom.StartDate2",
            endOrTarget: "Custom.TargetDate2"
          }
        })
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        commandKind: "WORK_ITEM_DUPLICATE",
        createdWorkItemId: 99
      });
      expect(postCalls).toEqual([
        {
          url: "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/$Task?api-version=7.1",
          body: [
            { op: "add", path: "/fields/System.Title", value: "Original (copy)" },
            { op: "add", path: "/fields/System.Tags", value: "alpha" },
            {
              op: "add",
              path: "/fields/Custom.StartDate2",
              value: "2026-03-01T00:00:00.000Z"
            },
            {
              op: "add",
              path: "/fields/Custom.TargetDate2",
              value: "2026-03-03T00:00:00.000Z"
            },
            {
              op: "add",
              path: "/relations/-",
              value: {
                rel: "System.LinkTypes.Hierarchy-Reverse",
                url: "https://dev.azure.com/contoso/delivery/_apis/wit/workItems/7"
              }
            }
          ]
        }
      ]);
    } finally {
      if (previousWriteEnabled === undefined) {
        delete process.env.ADO_WRITE_ENABLED;
      } else {
        process.env.ADO_WRITE_ENABLED = previousWriteEnabled;
      }
      await server.close();
    }
  });

  it("creates child work items via /phase2/work-item-child-create after validating the selected child type", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const previousWriteEnabled = process.env.ADO_WRITE_ENABLED;
    process.env.ADO_WRITE_ENABLED = "1";
    const getCalls: string[] = [];
    const postCalls: Array<{ url: string; body: unknown }> = [];
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get: async (url) => {
          getCalls.push(url);
          if (url.endsWith("/_apis/work/processconfiguration?api-version=7.1")) {
            return {
              status: 200,
              json: {
                taskBacklog: {
                  workItemTypes: [
                    { name: "Task" }
                  ]
                },
                requirementBacklog: {
                  workItemTypes: [
                    { name: " User Story " },
                    { name: "user story" }
                  ]
                },
                portfolioBacklogs: []
              },
              headers: {}
            };
          }

          return {
            status: 200,
            json: {
              fields: {
                "System.WorkItemType": "Feature",
                "System.AreaPath": "delivery\\Platform",
                "System.IterationPath": "delivery\\Sprint 2"
              }
            },
            headers: {}
          };
        },
        patch: async () => ({ status: 200, json: {}, headers: {} }),
        post: async (url, body) => {
          postCalls.push({ url, body });
          return {
            status: 200,
            json: {
              id: 99,
              fields: {
                "System.Title": "Child story",
                "System.WorkItemType": "User Story",
                "Custom.StartDate2": "2026-04-01",
                "Custom.TargetDate2": "2026-04-08"
              }
            },
            headers: {}
          };
        }
      }
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const invalidResponse = await fetch(`${server.baseUrl}/phase2/work-item-child-create`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          parentWorkItemId: 42,
          childType: "Task"
        })
      });
      expect(invalidResponse.status).toBe(400);

      const response = await fetch(`${server.baseUrl}/phase2/work-item-child-create`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          parentWorkItemId: 42,
          childWorkItemType: "user story",
          title: " Child story ",
          scheduleFieldRefs: {
            start: "Custom.StartDate2",
            endOrTarget: "Custom.TargetDate2"
          }
        })
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        commandKind: "WORK_ITEM_CHILD_CREATE",
        createdWorkItemId: 99,
        createdWorkItem: {
          id: 99,
          title: "Child story",
          workItemType: "User Story",
          parentWorkItemId: 42,
          schedule: {
            startDate: "2026-04-01",
            endDate: "2026-04-08"
          }
        }
      });
      expect(getCalls).toEqual([
        "https://dev.azure.com/contoso/delivery/_apis/work/processconfiguration?api-version=7.1",
        "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/42?api-version=7.1"
      ]);
      expect(postCalls).toEqual([
        {
          url: "https://dev.azure.com/contoso/delivery/_apis/wit/workitems/$User%20Story?api-version=7.1",
          body: [
            { op: "add", path: "/fields/System.Title", value: "Child story" },
            { op: "add", path: "/fields/System.AreaPath", value: "delivery\\Platform" },
            { op: "add", path: "/fields/System.IterationPath", value: "delivery\\Sprint 2" },
            {
              op: "add",
              path: "/relations/-",
              value: {
                rel: "System.LinkTypes.Hierarchy-Reverse",
                url: "https://dev.azure.com/contoso/delivery/_apis/wit/workItems/42"
              }
            }
          ]
        }
      ]);
    } finally {
      if (previousWriteEnabled === undefined) {
        delete process.env.ADO_WRITE_ENABLED;
      } else {
        process.env.ADO_WRITE_ENABLED = previousWriteEnabled;
      }
      await server.close();
    }
  });

  it("returns 422 for unavailable child-create types and does not POST", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const previousWriteEnabled = process.env.ADO_WRITE_ENABLED;
    process.env.ADO_WRITE_ENABLED = "1";
    const post = vi.fn(async () => ({ status: 200, json: { id: 99 }, headers: {} }));
    const get = vi.fn(async () => ({
      status: 200,
      json: {
        taskBacklog: {
          workItemTypes: [
            { name: "Task" }
          ]
        },
        requirementBacklog: {
          workItemTypes: [
            { name: "User Story" }
          ]
        },
        portfolioBacklogs: []
      },
      headers: {}
    }));
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get,
        patch: async () => ({ status: 200, json: {}, headers: {} }),
        post
      }
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/work-item-child-create`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          parentWorkItemId: 42,
          childWorkItemType: "Bug"
        })
      });
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toEqual({
        code: "WORK_ITEM_CHILD_TYPE_UNAVAILABLE",
        message: "Selected child work item type is not available in this Azure DevOps project.",
        result: {
          accepted: false,
          mode: "NO_OP",
          commandKind: "WORK_ITEM_CHILD_CREATE",
          operationCount: 0,
          reasonCode: "WORK_ITEM_CHILD_TYPE_UNAVAILABLE"
        }
      });
      expect(get).toHaveBeenCalledWith("https://dev.azure.com/contoso/delivery/_apis/work/processconfiguration?api-version=7.1");
      expect(post).not.toHaveBeenCalled();
    } finally {
      if (previousWriteEnabled === undefined) {
        delete process.env.ADO_WRITE_ENABLED;
      } else {
        process.env.ADO_WRITE_ENABLED = previousWriteEnabled;
      }
      await server.close();
    }
  });

  it("returns a controlled validation response when Azure rejects child creation", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const previousWriteEnabled = process.env.ADO_WRITE_ENABLED;
    process.env.ADO_WRITE_ENABLED = "1";
    const post = vi.fn(async () => ({
      status: 400,
      json: {
        message: "TF401320: Rule Error for field Custom.Required."
      },
      headers: {}
    }));
    const get = vi.fn(async (url: string) => {
      if (url.endsWith("/_apis/work/processconfiguration?api-version=7.1")) {
        return {
          status: 200,
          json: {
            taskBacklog: {
              workItemTypes: [
                { name: "Task" }
              ]
            },
            requirementBacklog: null,
            portfolioBacklogs: []
          },
          headers: {}
        };
      }

      return {
        status: 200,
        json: {
          fields: {
            "System.AreaPath": "delivery\\Platform",
            "System.IterationPath": "delivery\\Sprint 2"
          }
        },
        headers: {}
      };
    });
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get,
        patch: async () => ({ status: 200, json: {}, headers: {} }),
        post
      }
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/work-item-child-create`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          parentWorkItemId: 42,
          childWorkItemType: "Task"
        })
      });
      const body = await response.json();

      expect(response.status).toBe(422);
      expect(body).toEqual({
        code: "WORK_ITEM_CHILD_CREATE_FAILED",
        message: "WORK_ITEM_CHILD_CREATE_FAILED: TF401320: Rule Error for field Custom.Required."
      });
    } finally {
      if (previousWriteEnabled === undefined) {
        delete process.env.ADO_WRITE_ENABLED;
      } else {
        process.env.ADO_WRITE_ENABLED = previousWriteEnabled;
      }
      await server.close();
    }
  });

  it("returns controlled unsupported response when child-create POST transport is unavailable", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const previousWriteEnabled = process.env.ADO_WRITE_ENABLED;
    process.env.ADO_WRITE_ENABLED = "1";
    const get = vi.fn(async () => ({
      status: 200,
      json: {
        taskBacklog: {
          workItemTypes: [
            { name: "Task" }
          ]
        },
        requirementBacklog: null,
        portfolioBacklogs: []
      },
      headers: {}
    }));
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get,
        patch: async () => ({ status: 200, json: {}, headers: {} })
      }
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/work-item-child-create`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          parentWorkItemId: 42,
          childWorkItemType: "Task"
        })
      });
      const body = await response.json();

      expect(response.status).toBe(501);
      expect(body).toEqual({
        code: "WRITE_UNSUPPORTED",
        message: "Writeback operation is not supported by the configured Azure DevOps transport.",
        result: {
          accepted: false,
          mode: "NO_OP",
          commandKind: "WORK_ITEM_CHILD_CREATE",
          operationCount: 1,
          reasonCode: "WRITE_UNSUPPORTED"
        }
      });
      expect(get).toHaveBeenCalledWith("https://dev.azure.com/contoso/delivery/_apis/work/processconfiguration?api-version=7.1");
    } finally {
      if (previousWriteEnabled === undefined) {
        delete process.env.ADO_WRITE_ENABLED;
      } else {
        process.env.ADO_WRITE_ENABLED = previousWriteEnabled;
      }
      await server.close();
    }
  });

  it("returns controlled unsupported response when duplicate POST transport is unavailable", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const previousWriteEnabled = process.env.ADO_WRITE_ENABLED;
    process.env.ADO_WRITE_ENABLED = "1";
    const get = vi.fn(async () => ({
      status: 200,
      json: {},
      headers: {}
    }));
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get,
        patch: async () => ({ status: 200, json: {}, headers: {} })
      }
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/work-item-duplicate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          sourceWorkItemId: 42
        })
      });
      const body = await response.json();

      expect(response.status).toBe(501);
      expect(body).toEqual({
        code: "WRITE_UNSUPPORTED",
        message: "Writeback operation is not supported by the configured Azure DevOps transport.",
        result: {
          accepted: false,
          mode: "NO_OP",
          commandKind: "WORK_ITEM_DUPLICATE",
          operationCount: 1,
          reasonCode: "WRITE_UNSUPPORTED"
        }
      });
      expect(get).not.toHaveBeenCalled();
    } finally {
      if (previousWriteEnabled === undefined) {
        delete process.env.ADO_WRITE_ENABLED;
      } else {
        process.env.ADO_WRITE_ENABLED = previousWriteEnabled;
      }
      await server.close();
    }
  });

  it("forwards Azure duplicate creation validation details", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const previousWriteEnabled = process.env.ADO_WRITE_ENABLED;
    process.env.ADO_WRITE_ENABLED = "1";
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get: async () => ({
          status: 200,
          json: {
            fields: {
              "System.Title": "Original",
              "System.WorkItemType": "Task"
            }
          },
          headers: {}
        }),
        patch: async () => ({ status: 200, json: {}, headers: {} }),
        post: async () => ({
          status: 400,
          json: {
            message: "TF401320: Rule Error for field Custom.Required. Required fields must have a value."
          },
          headers: {}
        })
      }
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/work-item-duplicate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          sourceWorkItemId: 42
        })
      });
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({
        code: "WRITE_FAILED",
        message:
          "WORK_ITEM_DUPLICATE_FAILED: TF401320: Rule Error for field Custom.Required. Required fields must have a value."
      });
    } finally {
      if (previousWriteEnabled === undefined) {
        delete process.env.ADO_WRITE_ENABLED;
      } else {
        process.env.ADO_WRITE_ENABLED = previousWriteEnabled;
      }
      await server.close();
    }
  });

  it("persists and reloads user preferences via /phase2/user-preferences", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      mappingFilePath: fixture.mappingFilePath,
      userPreferencesFilePath: fixture.userPreferencesFilePath
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const saveResponse = await fetch(`${server.baseUrl}/phase2/user-preferences`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          preferences: {
            themeMode: "dark",
            timelineColorCoding: "status",
            timelineDetailsWidthPx: 444,
            timelineSidebarWidthPx: 280,
            timelineLabelFields: [],
            timelineSidebarFields: ["title", "Custom.Team"],
            savedQueries: [
              {
                id: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
                name: "delivery/default",
                queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=37f6f880-0b7b-4350-9f97-7263b40d4e95",
                organization: "contoso",
                project: "delivery"
              }
            ],
            selectedHeaderQueryId: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
            filters: {
              assignee: "me"
            }
          }
        })
      });
      const saveBody = await saveResponse.json();

      expect(saveResponse.status).toBe(200);
      expect(saveBody.preferences.themeMode).toBe("dark");
      expect(saveBody.preferences.timelineColorCoding).toBe("status");
      expect(saveBody.preferences.timelineDetailsWidthPx).toBe(444);
      expect(saveBody.preferences.timelineSidebarWidthPx).toBe(280);
      expect(saveBody.preferences.timelineLabelFields).toEqual([]);
      expect(saveBody.preferences.timelineSidebarFields).toEqual(["title", "Custom.Team"]);
      expect(saveBody.preferences.savedQueries).toEqual([
        {
          id: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
          name: "delivery/default",
          queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=37f6f880-0b7b-4350-9f97-7263b40d4e95",
          organization: "contoso",
          project: "delivery"
        }
      ]);
      expect(saveBody.preferences.selectedHeaderQueryId).toBe("37f6f880-0b7b-4350-9f97-7263b40d4e95");
      expect(saveBody.preferences.filters).toEqual({
        assignee: "me"
      });

      const loadResponse = await fetch(`${server.baseUrl}/phase2/user-preferences`);
      const loadBody = await loadResponse.json();

      expect(loadResponse.status).toBe(200);
      expect(loadBody.preferences.themeMode).toBe("dark");
      expect(loadBody.preferences.timelineColorCoding).toBe("status");
      expect(loadBody.preferences.timelineDetailsWidthPx).toBe(444);
      expect(loadBody.preferences.timelineSidebarWidthPx).toBe(280);
      expect(loadBody.preferences.timelineLabelFields).toEqual([]);
      expect(loadBody.preferences.timelineSidebarFields).toEqual(["title", "Custom.Team"]);
      expect(loadBody.preferences.savedQueries).toEqual([
        {
          id: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
          name: "delivery/default",
          queryInput: "https://dev.azure.com/contoso/delivery/_queries/query?qid=37f6f880-0b7b-4350-9f97-7263b40d4e95",
          organization: "contoso",
          project: "delivery"
        }
      ]);
      expect(loadBody.preferences.selectedHeaderQueryId).toBe("37f6f880-0b7b-4350-9f97-7263b40d4e95");
      expect(loadBody.preferences.filters).toEqual({
        assignee: "me"
      });
    } finally {
      await server.close();
    }
  });

  it("rejects local config reset when confirmation is wrong or body is not strict", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      userPreferencesFilePath: fixture.userPreferencesFilePath
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const wrongConfirmationResponse = await fetch(`${server.baseUrl}/phase2/local-config-reset`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          confirmation: "delete all configs"
        })
      });
      const wrongConfirmationBody = await wrongConfirmationResponse.json();

      expect(wrongConfirmationResponse.status).toBe(400);
      expect(wrongConfirmationBody).toEqual({
        code: "INVALID_CONFIRMATION",
        message: "Confirmation must be DELETE ALL CONFIGS."
      });

      const extraFieldResponse = await fetch(`${server.baseUrl}/phase2/local-config-reset`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          confirmation: LOCAL_CONFIG_RESET_CONFIRMATION,
          extra: true
        })
      });
      const extraFieldBody = await extraFieldResponse.json();

      expect(extraFieldResponse.status).toBe(400);
      expect(extraFieldBody).toEqual({
        code: "INVALID_INPUT",
        message: "Provide confirmation as the only request field."
      });
    } finally {
      await server.close();
    }
  });

  it("clears local config files and only the current lowdb user via /phase2/local-config-reset", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const currentUserId = resolveTestLocalUserId();
    await writeFile(
      fixture.mappingFilePath,
      JSON.stringify({
        profiles: [
          {
            id: "profile-a",
            name: "Default",
            fields: {
              id: "System.Id",
              title: "System.Title",
              start: "Microsoft.VSTS.Scheduling.StartDate",
              endOrTarget: "Microsoft.VSTS.Scheduling.TargetDate"
            }
          }
        ],
        lastActiveProfileId: "profile-a"
      }),
      "utf8"
    );
    await writeFile(
      fixture.userPreferencesFilePath,
      JSON.stringify({
        version: 1,
        users: {
          [currentUserId]: {
            themeMode: "dark"
          },
          "other-user": {
            themeMode: "light"
          }
        }
      }),
      "utf8"
    );
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      userPreferencesFilePath: fixture.userPreferencesFilePath
    });

    try {
      const csrfToken = await fetchCsrfToken(server.baseUrl);
      const response = await fetch(`${server.baseUrl}/phase2/local-config-reset`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          confirmation: LOCAL_CONFIG_RESET_CONFIRMATION
        })
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("completed");
      expect(body.targets.map((target: { target: string; status: string }) => [target.target, target.status])).toEqual([
        ["lowdb-current-user-preferences", "deleted"],
        ["ado-context-settings", "deleted"],
        ["mapping-settings", "deleted"],
        ["ado-communication-log", "skipped"],
        ["work-item-type-state-runtime-maps", "skipped"]
      ]);
      await expect(readFile(fixture.contextFilePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      await expect(readFile(fixture.mappingFilePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      const persistedPreferences = JSON.parse(await readFile(fixture.userPreferencesFilePath, "utf8")) as {
        users: Record<string, unknown>;
      };
      expect(persistedPreferences.users[currentUserId]).toBeUndefined();
      expect(persistedPreferences.users["other-user"]).toEqual({
        themeMode: "light"
      });

      const secondResponse = await fetch(`${server.baseUrl}/phase2/local-config-reset`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-ado-csrf-token": csrfToken
        },
        body: JSON.stringify({
          confirmation: LOCAL_CONFIG_RESET_CONFIRMATION
        })
      });
      const secondBody = await secondResponse.json();

      expect(secondResponse.status).toBe(200);
      expect(secondBody.targets.map((target: { target: string; status: string }) => [target.target, target.status])).toEqual([
        ["lowdb-current-user-preferences", "skipped"],
        ["ado-context-settings", "skipped"],
        ["mapping-settings", "skipped"],
        ["ado-communication-log", "skipped"],
        ["work-item-type-state-runtime-maps", "skipped"]
      ]);
    } finally {
      await server.close();
    }
  });

  it("loads available work item types via /phase2/work-item-types", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const get = vi.fn(async () => ({
      status: 200,
      json: {
        taskBacklog: {
          workItemTypes: [
            { name: "Task" }
          ]
        },
        requirementBacklog: {
          workItemTypes: [
            { name: " feature " },
            { name: "Feature" },
            { name: "" }
          ]
        },
        portfolioBacklogs: [
          {
            workItemTypes: [
              { name: "Bug" }
            ]
          }
        ]
      },
      headers: {}
    }));
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: { get }
    });

    try {
      const firstResponse = await fetch(`${server.baseUrl}/phase2/work-item-types`);
      const firstBody = await firstResponse.json();
      const secondResponse = await fetch(`${server.baseUrl}/phase2/work-item-types`);

      expect(firstResponse.status).toBe(200);
      expect(firstBody).toEqual({
        workItemTypes: [
          { name: "Bug" },
          { name: "feature" },
          { name: "Task" }
        ]
      });
      expect(secondResponse.status).toBe(200);
      expect(get).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledWith("https://dev.azure.com/contoso/delivery/_apis/work/processconfiguration?api-version=7.1");
    } finally {
      await server.close();
    }
  });

  it("does not retain failed work item type cache entries", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        status: 500,
        json: { message: "Temporary Azure outage" },
        headers: {}
      })
      .mockResolvedValueOnce({
        status: 200,
        json: {
          taskBacklog: {
            workItemTypes: [
              { name: "Task" }
            ]
          },
          requirementBacklog: null,
          portfolioBacklogs: []
        },
        headers: {}
      });
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: { get }
    });

    try {
      const failedResponse = await fetch(`${server.baseUrl}/phase2/work-item-types`);
      const retryResponse = await fetch(`${server.baseUrl}/phase2/work-item-types`);
      const retryBody = await retryResponse.json();

      expect(failedResponse.status).toBe(500);
      expect(retryResponse.status).toBe(200);
      expect(retryBody).toEqual({
        workItemTypes: [
          { name: "Task" }
        ]
      });
      expect(get).toHaveBeenCalledTimes(2);
    } finally {
      await server.close();
    }
  });

  it("loads query details via /phase2/query-details", async () => {
    const fixture = await createFixtureDir(tempDirs);
    const queryId = "342f0f44-4069-46b1-a940-3d0468979ceb";
    const server = startServer({
      distRootPath: fixture.distRootPath,
      contextFilePath: fixture.contextFilePath,
      httpClient: {
        get: async (url) => {
          if (url.includes(`/_apis/wit/queries/${queryId}`)) {
            return {
              status: 200,
              json: {
                id: queryId,
                name: "Active Bugs",
                path: "My Queries/Website/Active Bugs"
              },
              headers: {}
            };
          }

          return {
            status: 200,
            json: { value: [] },
            headers: {}
          };
        }
      }
    });

    try {
      const response = await fetch(`${server.baseUrl}/phase2/query-details?queryId=${encodeURIComponent(queryId)}`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        id: queryId,
        name: "Active Bugs",
        path: "My Queries/Website/Active Bugs"
      });
    } finally {
      await server.close();
    }
  });
});

function startServer(params: {
  distRootPath: string;
  contextFilePath: string;
  mappingFilePath?: string;
  userPreferencesFilePath?: string;
  httpClient?: {
    get: (url: string) => Promise<{
      status: number;
      json: unknown;
      headers: Record<string, string | undefined>;
    }>;
    patch?: (url: string, body: unknown, headers?: Record<string, string>) => Promise<{
      status: number;
      json: unknown;
      headers: Record<string, string | undefined>;
    }>;
    post?: (url: string, body: unknown, headers?: Record<string, string>) => Promise<{
      status: number;
      json: unknown;
      headers: Record<string, string | undefined>;
    }>;
  };
  azLoginRunner?: () => Promise<{ message: string }>;
  azCliPathResolver?: () => Promise<string>;
  authPreflightRunner?: CliCommandRunner;
}): StartedServer {
  const port = 18080 + Math.floor(Math.random() * 1000);
  const server = createHttpServer({
    port,
    distRootPath: params.distRootPath,
    contextFilePath: params.contextFilePath,
    mappingFilePath: params.mappingFilePath,
    userPreferencesFilePath: params.userPreferencesFilePath,
    httpClient:
      params.httpClient ??
      {
        get: async () => ({
          status: 200,
          json: {
            value: []
          },
          headers: {}
        })
      },
    azLoginRunner: params.azLoginRunner,
    azCliPathResolver: params.azCliPathResolver,
    authPreflightRunner: params.authPreflightRunner
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => server.close()
  };
}

async function fetchCsrfToken(baseUrl: string): Promise<string> {
  const response = await fetch(baseUrl, {
    method: "GET",
    headers: {
      accept: "text/html"
    }
  });
  const html = await response.text();
  const match = html.match(/<meta name="ado-csrf-token" content="([^"]+)"/);
  if (!match) {
    throw new Error("CSRF token meta tag missing in root HTML.");
  }

  return match[1];
}

function readPngDimensions(buffer: Buffer): { width: number; height: number } {
  expect(buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(buffer.subarray(12, 16).toString("ascii")).toBe("IHDR");

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function resolveTestLocalUserId(): string {
  const fromEnv = process.env.USER ?? process.env.USERNAME;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  try {
    return os.userInfo().username;
  } catch {
    return "local-user";
  }
}

async function createFixtureDir(tempDirs: string[]): Promise<{
  root: string;
  distRootPath: string;
  contextFilePath: string;
  mappingFilePath: string;
  userPreferencesFilePath: string;
  azCliShimPath: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "azure-ganttops-http-server-"));
  tempDirs.push(root);

  const distRootPath = path.join(root, "dist");
  await mkdir(path.join(distRootPath, "src", "app", "bootstrap"), { recursive: true });
  await writeFile(path.join(distRootPath, "src", "app", "bootstrap", "local-ui-entry.browser.js"), "export {}\n", "utf8");

  const contextFilePath = path.join(root, "ado-context.json");
  const mappingFilePath = path.join(root, "mapping-settings.json");
  const userPreferencesFilePath = path.join(root, "user-preferences.json");
  await writeFile(
    contextFilePath,
    JSON.stringify({
      organization: "contoso",
      project: "delivery"
    }),
    "utf8"
  );

  const azCliShimPath = path.join(root, "az");
  await writeFile(
    azCliShimPath,
    [
      "#!/bin/sh",
      "if [ \"$1\" = \"--version\" ]; then",
      "  echo 'azure-cli 2.0'",
      "  exit 0",
      "fi",
      "if [ \"$1\" = \"extension\" ] && [ \"$2\" = \"show\" ]; then",
      "  echo '{}'",
      "  exit 0",
      "fi",
      "if [ \"$1\" = \"account\" ] && [ \"$2\" = \"show\" ]; then",
      "  echo '{}'",
      "  exit 0",
      "fi",
      "if [ \"$1\" = \"devops\" ] && [ \"$2\" = \"configure\" ] && [ \"$3\" = \"--list\" ]; then",
      "  echo 'organization = contoso'",
      "  echo 'project = delivery'",
      "  exit 0",
      "fi",
      "exit 1"
    ].join("\n"),
    "utf8"
  );
  await chmod(azCliShimPath, 0o755);

  return {
    root,
    distRootPath,
    contextFilePath,
    mappingFilePath,
    userPreferencesFilePath,
    azCliShimPath
  };
}
