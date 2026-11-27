import { describe, expect, it } from "vitest";

import {
  resolveQueryRunInput,
  resolveRuntimeQueryInput,
  tryResolveRuntimeQueryInput
} from "./runtime-query-input.js";

const QUERY_ID = "37f6f880-0b7b-4350-9f97-7263b40d4e95";
const TRANSPORT_URL = `https://dev.azure.com/contoso/delivery/_queries/query/${QUERY_ID}`;

describe("runtime-query-input", () => {
  it("resolves a full Azure DevOps query URL through the domain parser", () => {
    const resolved = resolveRuntimeQueryInput(
      `https://dev.azure.com/contoso/delivery/_queries/query?qid=${QUERY_ID}`
    );

    expect(resolved).toEqual({
      rawInput: `https://dev.azure.com/contoso/delivery/_queries/query?qid=${QUERY_ID}`,
      transportQueryInput: TRANSPORT_URL,
      resolvedContext: {
        organization: "contoso",
        project: "delivery",
        queryId: QUERY_ID
      }
    });
  });

  it("does not double encode encoded project segments from path query URLs", () => {
    const resolved = resolveRuntimeQueryInput(
      `https://dev.azure.com/contoso/My%20Project/_queries/query/${QUERY_ID}`
    );

    expect(resolved.transportQueryInput).toBe(
      `https://dev.azure.com/contoso/My%20Project/_queries/query/${QUERY_ID}`
    );
    expect(resolved.resolvedContext.project).toBe("My Project");
  });

  it("does not double encode encoded project segments from qid query URLs", () => {
    const resolved = resolveRuntimeQueryInput(
      `https://dev.azure.com/contoso/My%20Project/_queries/query?qid=${QUERY_ID}`
    );

    expect(resolved.transportQueryInput).toBe(
      `https://dev.azure.com/contoso/My%20Project/_queries/query/${QUERY_ID}`
    );
    expect(resolved.resolvedContext.project).toBe("My Project");
  });

  it("resolves a raw query ID with runtime defaults", () => {
    expect(resolveQueryRunInput(QUERY_ID, "contoso", "delivery")).toBe(TRANSPORT_URL);
  });

  it("returns null for raw IDs without complete context", () => {
    expect(tryResolveRuntimeQueryInput(QUERY_ID, { organization: "contoso", project: "" })).toBeNull();
  });

  it("keeps domain parser validation for malformed input", () => {
    expect(() => resolveRuntimeQueryInput("123", { organization: "contoso", project: "delivery" })).toThrow(
      "Paste a valid Azure DevOps query URL."
    );
  });
});
