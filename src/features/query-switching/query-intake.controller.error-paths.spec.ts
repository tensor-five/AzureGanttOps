import { describe, expect, it } from "vitest";

import { buildParseErrorFailureState, buildRuntimeErrorFailureState } from "./query-intake.controller.error-paths.js";

describe("query-intake.controller.error-paths", () => {
  it("builds parse error failure state with unknown error defaults", () => {
    const state = buildParseErrorFailureState({
      error: new Error("bad query"),
      dismissStrictFailWarning: false
    });

    expect(state.guidance).toBe("bad query");
    expect(state.preflightStatus).toBe("UNKNOWN_ERROR");
    expect(state.statusCode).toBe("UNKNOWN_ERROR");
    expect(state.errorCode).toBe("UNKNOWN_ERROR");
    expect(state.uiState).toBe("query_failure");
  });

  it("builds runtime error failure state with diagnostics mapping", () => {
    const state = buildRuntimeErrorFailureState({
      error: new Error("QUERY_EXECUTION_FAILED"),
      dismissStrictFailWarning: true
    });

    expect(state.guidance).toContain("Query failed to run");
    expect(state.preflightStatus).toBe("READY");
    expect(state.statusCode).toBe("QUERY_EXECUTION_FAILED");
    expect(state.errorCode).toBe("QUERY_EXECUTION_FAILED");
    expect(state.strictFail.dismissed).toBe(true);
  });
});
