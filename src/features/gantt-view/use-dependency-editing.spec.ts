// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DEPENDENCY_VIEW_MODE_OPTIONS, useDependencyEditing } from "./use-dependency-editing.js";

describe("useDependencyEditing", () => {
  it("keeps default dependency mode and updates drag/selection state", () => {
    const { result } = renderHook(() => useDependencyEditing());

    expect(result.current.dependencyViewMode).toBe("show");
    expect(result.current.activeDependencyDrag).toBeNull();
    expect(result.current.selectedDependency).toBeNull();
    expect(DEPENDENCY_VIEW_MODE_OPTIONS.map((entry) => entry.value)).toEqual(["show", "edit", "violations", "none"]);

    act(() => {
      result.current.setDependencyViewMode("edit");
      result.current.setSelectedDependency({
        predecessorWorkItemId: 11,
        successorWorkItemId: 12,
        dependencyType: "FS"
      });
    });

    expect(result.current.dependencyViewMode).toBe("edit");
    expect(result.current.selectedDependency?.successorWorkItemId).toBe(12);
  });
});
