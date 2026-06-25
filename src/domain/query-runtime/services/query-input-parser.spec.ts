import { describe, expect, it } from "vitest";

import { parseQueryInput } from "./query-input-parser.js";

describe("parseQueryInput", () => {
  it("parses full query URL with qid parameter", () => {
    const context = parseQueryInput(
      "https://dev.azure.com/contoso/delivery/_queries/query?qid=37f6f880-0b7b-4350-9f97-7263b40d4e95"
    );

    expect(context.organization).toBe("contoso");
    expect(context.project).toBe("delivery");
    expect(context.queryId.value).toBe("37f6f880-0b7b-4350-9f97-7263b40d4e95");
  });

  it("parses full query URL with ID in path", () => {
    const context = parseQueryInput(
      "https://dev.azure.com/contoso/delivery/_queries/query/37f6f880-0b7b-4350-9f97-7263b40d4e95"
    );

    expect(context.organization).toBe("contoso");
    expect(context.project).toBe("delivery");
    expect(context.queryId.value).toBe("37f6f880-0b7b-4350-9f97-7263b40d4e95");
  });

  it("decodes encoded organization and project path segments for path query URLs", () => {
    const context = parseQueryInput(
      "https://dev.azure.com/contoso/My%20Project/_queries/query/37f6f880-0b7b-4350-9f97-7263b40d4e95"
    );

    expect(context.organization).toBe("contoso");
    expect(context.project).toBe("My Project");
    expect(context.queryId.value).toBe("37f6f880-0b7b-4350-9f97-7263b40d4e95");
  });

  it("decodes encoded organization and project path segments for qid query URLs", () => {
    const context = parseQueryInput(
      "https://dev.azure.com/contoso/My%20Project/_queries/query?qid=37f6f880-0b7b-4350-9f97-7263b40d4e95"
    );

    expect(context.organization).toBe("contoso");
    expect(context.project).toBe("My Project");
    expect(context.queryId.value).toBe("37f6f880-0b7b-4350-9f97-7263b40d4e95");
  });

  it("parses raw query ID when defaults are available", () => {
    const context = parseQueryInput("37f6f880-0b7b-4350-9f97-7263b40d4e95", {
      organization: "contoso",
      project: "delivery"
    });

    expect(context.organization).toBe("contoso");
    expect(context.project).toBe("delivery");
    expect(context.queryId.value).toBe("37f6f880-0b7b-4350-9f97-7263b40d4e95");
  });

  it("rejects malformed input", () => {
    expect(() => parseQueryInput("not-a-url-or-id")).toThrow("Paste a valid Azure DevOps query URL.");
  });

  it("rejects URL without query ID", () => {
    expect(() => parseQueryInput("https://dev.azure.com/contoso/delivery/_queries")).toThrow(
      "Paste a valid Azure DevOps query URL."
    );
  });

  it("rejects Azure DevOps URLs outside the query route even when they contain a GUID", () => {
    expect(() =>
      parseQueryInput(
        "https://dev.azure.com/contoso/delivery/_workitems/edit/37f6f880-0b7b-4350-9f97-7263b40d4e95"
      )
    ).toThrow("Paste a valid Azure DevOps query URL.");
  });

  it("rejects raw query ID when settings context is missing", () => {
    expect(() => parseQueryInput("37f6f880-0b7b-4350-9f97-7263b40d4e95")).toThrow(
      "Add organization and project in settings."
    );
  });
});
