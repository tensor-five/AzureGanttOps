import { describe, expect, it } from "vitest";

import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";
import { resolveInitialQueryOnboardingStatus } from "./ui-client-initial-query-onboarding.js";

describe("ui-client-initial-query-onboarding", () => {
  it("keeps onboarding pending while preferences hydrate to avoid dialog flicker", () => {
    expect(
      resolveInitialQueryOnboardingStatus({
        hydrationState: "pending",
        preferences: null,
        restoredResponse: null,
      })
    ).toBe("pending_hydration");
  });

  it("requires onboarding after hydration when no query source is known", () => {
    expect(
      resolveInitialQueryOnboardingStatus({
        hydrationState: "hydrated",
        preferences: {},
        restoredResponse: null,
      })
    ).toBe("required");
  });

  it("completes when lowdb preferences already contain saved queries", () => {
    expect(
      resolveInitialQueryOnboardingStatus({
        hydrationState: "hydrated",
        preferences: {
          savedQueries: [
            {
              id: "37f6f880-0b7b-4350-9f97-7263b40d4e95",
              name: "Delivery",
              queryInput: "https://dev.azure.com/contoso/delivery/_queries/query/37f6f880-0b7b-4350-9f97-7263b40d4e95"
            }
          ]
        },
        restoredResponse: null
      })
    ).toBe("completed");
  });

  it("completes when a restored response has READY OK and active query id", () => {
    expect(
      resolveInitialQueryOnboardingStatus({
        hydrationState: "hydrated",
        preferences: {},
        restoredResponse: {
          preflightStatus: "READY",
          statusCode: "OK",
          activeQueryId: "query-1"
        } as QueryIntakeResponse
      })
    ).toBe("completed");
  });

  it("requires onboarding for restored auth failures", () => {
    expect(
      resolveInitialQueryOnboardingStatus({
        hydrationState: "hydrated",
        preferences: {},
        restoredResponse: {
          preflightStatus: "SESSION_EXPIRED",
          statusCode: "SESSION_EXPIRED",
          activeQueryId: "query-1"
        } as QueryIntakeResponse
      })
    ).toBe("required");
  });

  it("requires onboarding for restored runtime failures", () => {
    expect(
      resolveInitialQueryOnboardingStatus({
        hydrationState: "hydrated",
        preferences: {},
        restoredResponse: {
          preflightStatus: "ERROR",
          statusCode: "RUNTIME_ERROR",
          activeQueryId: "query-1"
        } as unknown as QueryIntakeResponse
      })
    ).toBe("required");
  });

  it("requires onboarding for restored responses without active query id", () => {
    expect(
      resolveInitialQueryOnboardingStatus({
        hydrationState: "hydrated",
        preferences: {},
        restoredResponse: {
          preflightStatus: "READY",
          statusCode: "OK",
          activeQueryId: null
        } as QueryIntakeResponse
      })
    ).toBe("required");
  });
});
