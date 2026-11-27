import { describe, expect, it, vi } from "vitest";

import { writeAdoHttpFailureLog } from "./ado-http-failure-logging.js";

describe("writeAdoHttpFailureLog", () => {
  it("writes terminal-prefixed structured JSON by default", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      writeAdoHttpFailureLog({
        timestamp: "2026-07-14T12:00:00.000Z",
        failureType: "response",
        method: "GET",
        url: "/contoso/delivery/_apis/example",
        status: 503,
        durationMs: 9,
        responsePreview: '{"message":"Unavailable"}'
      });

      expect(consoleError).toHaveBeenCalledWith(
        expect.stringMatching(/^\[ado-runtime\] \{"event":"ado-http\.failure"/)
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("logs response diagnostics and safe state patch context", () => {
    const writer = vi.fn();

    writeAdoHttpFailureLog(
      {
        timestamp: "2026-07-14T12:00:00.000Z",
        failureType: "response",
        method: "PATCH",
        url: "/contoso/delivery/_apis/wit/workitems/42?api-version=7.1",
        status: 400,
        durationMs: 73,
        requestBody: [
          { op: "test", path: "/rev", value: 18 },
          { op: "add", path: "/fields/System.State", value: "Closed" }
        ],
        responseHeaders: {
          "X-VSS-E2EID": "request-123"
        },
        responsePreview: '{"message":"State transition is not allowed."}'
      },
      writer
    );

    expect(writer).toHaveBeenCalledWith({
      event: "ado-http.failure",
      timestamp: "2026-07-14T12:00:00.000Z",
      failureType: "response",
      method: "PATCH",
      url: "/contoso/delivery/_apis/wit/workitems/42?api-version=7.1",
      status: 400,
      durationMs: 73,
      requestId: {
        header: "x-vss-e2eid",
        value: "request-123"
      },
      jsonPatch: {
        operationCount: 2,
        operations: [
          { op: "test", path: "/rev", value: 18 },
          { op: "add", path: "/fields/System.State", value: "Closed" }
        ]
      },
      responsePreview: '{"message":"State transition is not allowed."}'
    });
  });

  it("does not log arbitrary work item field values", () => {
    const writer = vi.fn();

    writeAdoHttpFailureLog(
      {
        timestamp: "2026-07-14T12:00:00.000Z",
        failureType: "response",
        method: "PATCH",
        url: "/contoso/delivery/_apis/wit/workitems/42?api-version=7.1",
        status: 400,
        durationMs: 11,
        requestBody: [
          { op: "add", path: "/fields/System.Title", value: "Confidential title" },
          { op: "add", path: "/fields/System.Description", value: "Confidential description" }
        ],
        responsePreview: "{}"
      },
      writer
    );

    const payload = writer.mock.calls[0]?.[0];
    expect(payload.jsonPatch).toEqual({
      operationCount: 2,
      operations: [
        { op: "add", path: "/fields/System.Title" },
        { op: "add", path: "/fields/System.Description" }
      ]
    });
    expect(JSON.stringify(payload)).not.toContain("Confidential");
  });

  it("logs transport failures without inventing response metadata", () => {
    const writer = vi.fn();

    writeAdoHttpFailureLog(
      {
        timestamp: "2026-07-14T12:00:00.000Z",
        failureType: "transport",
        method: "PATCH",
        url: "/contoso/delivery/_apis/wit/workitems/42?api-version=7.1",
        status: null,
        durationMs: 250,
        requestBody: [{ op: "add", path: "/fields/System.State", value: "Closed" }],
        responsePreview: '{"message":"fetch failed"}'
      },
      writer
    );

    expect(writer).toHaveBeenCalledWith(
      expect.objectContaining({
        failureType: "transport",
        status: null,
        requestId: null,
        responsePreview: '{"message":"fetch failed"}'
      })
    );
  });
});
