import { describe, expect, it } from "vitest";

import { buildAutoAppliedProfileId, proposeDefaultMapping } from "./default-mapping-proposal.js";

describe("proposeDefaultMapping", () => {
  const queryId = "37f6f880-0b7b-4350-9f97-7263b40d4e95";

  it("returns valid profile when all standard fields are present", () => {
    const proposal = proposeDefaultMapping({
      queryId,
      availableFieldRefs: [
        "System.Id",
        "System.Title",
        "Microsoft.VSTS.Scheduling.StartDate",
        "Microsoft.VSTS.Scheduling.TargetDate"
      ]
    });

    expect(proposal.status).toBe("valid");
    if (proposal.status !== "valid") {
      throw new Error("expected valid proposal");
    }
    expect(proposal.profile.id).toBe(buildAutoAppliedProfileId(queryId));
    expect(proposal.profile.fields).toEqual({
      id: "System.Id",
      title: "System.Title",
      start: "Microsoft.VSTS.Scheduling.StartDate",
      endOrTarget: "Microsoft.VSTS.Scheduling.TargetDate"
    });
  });

  it("falls back to custom field aliases when standards are missing", () => {
    const proposal = proposeDefaultMapping({
      queryId,
      availableFieldRefs: [
        "Custom.ExternalId",
        "System.Title",
        "Custom.StartDate",
        "Microsoft.VSTS.Scheduling.FinishDate"
      ]
    });

    expect(proposal.status).toBe("valid");
    if (proposal.status !== "valid") {
      throw new Error("expected valid proposal");
    }
    expect(proposal.profile.fields).toEqual({
      id: "Custom.ExternalId",
      title: "System.Title",
      start: "Custom.StartDate",
      endOrTarget: "Microsoft.VSTS.Scheduling.FinishDate"
    });
  });

  it("returns invalid with the missing required fields when start/end are absent", () => {
    const proposal = proposeDefaultMapping({
      queryId,
      availableFieldRefs: ["System.Id", "System.Title"]
    });

    expect(proposal.status).toBe("invalid");
    if (proposal.status !== "invalid") {
      throw new Error("expected invalid proposal");
    }
    expect(proposal.missingRequired).toEqual(["start", "endOrTarget"]);
  });

  it("returns invalid with all four missing required fields when no refs are available", () => {
    const proposal = proposeDefaultMapping({
      queryId,
      availableFieldRefs: []
    });

    expect(proposal.status).toBe("invalid");
    if (proposal.status !== "invalid") {
      throw new Error("expected invalid proposal");
    }
    expect(proposal.missingRequired).toEqual(["id", "title", "start", "endOrTarget"]);
  });

  it("ignores blank and whitespace-only refs", () => {
    const proposal = proposeDefaultMapping({
      queryId,
      availableFieldRefs: ["", "   ", "System.Id", "System.Title"]
    });

    expect(proposal.status).toBe("invalid");
    if (proposal.status !== "invalid") {
      throw new Error("expected invalid proposal");
    }
    expect(proposal.missingRequired).toEqual(["start", "endOrTarget"]);
  });
});
