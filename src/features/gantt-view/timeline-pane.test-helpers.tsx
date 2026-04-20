import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

import type { TimelineReadModel } from "../../application/dto/timeline-read-model.js";
import { clearTimelineColorCodingPreferenceForTests } from "./timeline-color-coding-preference.js";
import { clearTimelineDetailsWidthPreferenceForTests } from "./timeline-details-width-preference.js";
import { clearTimelineLabelFieldsPreferenceForTests } from "./timeline-label-fields-preference.js";
import { clearTimelineSidebarRowJustifyPreferenceForTests } from "./timeline-sidebar-row-justify-preference.js";
import { clearTimelineSidebarFieldsPreferenceForTests } from "./timeline-sidebar-fields-preference.js";
import { clearTimelineSidebarWidthPreferenceForTests } from "./timeline-sidebar-width-preference.js";
import { clearTimelineSortPreferenceForTests } from "./timeline-sort-preference.js";
import { clearTimelineViewportPreferenceForTests } from "./timeline-viewport-preference.js";

export function registerTimelinePaneSpecCleanup(): void {
  afterEach(() => {
    cleanup();
    clearTimelineColorCodingPreferenceForTests();
    clearTimelineDetailsWidthPreferenceForTests();
    clearTimelineLabelFieldsPreferenceForTests();
    clearTimelineSidebarRowJustifyPreferenceForTests();
    clearTimelineSidebarFieldsPreferenceForTests();
    clearTimelineSidebarWidthPreferenceForTests();
    clearTimelineSortPreferenceForTests();
    clearTimelineViewportPreferenceForTests();
    window.history.replaceState(window.history.state, "", "/");
  });
}

export function makeTimeline(): TimelineReadModel {
  return {
    queryType: "flat",
    bars: [
      {
        workItemId: 11,
        title: "Source Item",
        state: { code: "Active", badge: "A", color: "#2f855a" },
        schedule: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-03T00:00:00.000Z",
          missingBoundary: null
        },
        details: { mappedId: "11" }
      }
    ],
    unschedulable: [
      {
        workItemId: 22,
        title: "Target Item",
        state: { code: "New", badge: "N", color: "#2b6cb0" },
        details: { mappedId: "22", parentWorkItemId: 11 },
        reason: "missing-both-dates"
      }
    ],
    dependencies: [],
    suppressedDependencies: [],
    treeLayout: null,
    mappingValidation: {
      status: "valid",
      issues: []
    }
  };
}

export function makeDependencyTimeline(): TimelineReadModel {
  const base = makeTimeline();
  return {
    ...base,
    bars: [
      base.bars[0],
      {
        ...base.bars[0],
        workItemId: 12,
        title: "Dependent Item",
        details: { mappedId: "12" },
        schedule: {
          startDate: "2026-03-05T00:00:00.000Z",
          endDate: "2026-03-07T00:00:00.000Z",
          missingBoundary: null
        }
      }
    ],
    unschedulable: [],
    dependencies: [
      {
        predecessorWorkItemId: 11,
        successorWorkItemId: 12,
        dependencyType: "FS",
        label: "#11 [end] -> #12 [start]"
      }
    ]
  };
}

export function makeViolatingDependencyTimeline(): TimelineReadModel {
  const base = makeDependencyTimeline();
  return {
    ...base,
    bars: [
      {
        ...base.bars[0],
        workItemId: 11,
        details: { mappedId: "11" },
        schedule: {
          startDate: "2026-03-06T00:00:00.000Z",
          endDate: "2026-03-10T00:00:00.000Z",
          missingBoundary: null
        }
      },
      {
        ...base.bars[1],
        workItemId: 12,
        details: { mappedId: "12" },
        schedule: {
          startDate: "2026-03-07T00:00:00.000Z",
          endDate: "2026-03-08T00:00:00.000Z",
          missingBoundary: null
        }
      }
    ]
  };
}

export function makeMixedDependencyTimeline(): TimelineReadModel {
  const base = makeDependencyTimeline();
  return {
    ...base,
    bars: [
      {
        ...base.bars[0],
        workItemId: 11,
        details: { mappedId: "11" },
        schedule: {
          startDate: "2026-03-06T00:00:00.000Z",
          endDate: "2026-03-10T00:00:00.000Z",
          missingBoundary: null
        }
      },
      {
        ...base.bars[1],
        workItemId: 12,
        details: { mappedId: "12" },
        schedule: {
          startDate: "2026-03-07T00:00:00.000Z",
          endDate: "2026-03-08T00:00:00.000Z",
          missingBoundary: null
        }
      },
      {
        ...base.bars[1],
        workItemId: 13,
        title: "Third Item",
        details: { mappedId: "13" },
        schedule: {
          startDate: "2026-03-11T00:00:00.000Z",
          endDate: "2026-03-12T00:00:00.000Z",
          missingBoundary: null
        }
      }
    ],
    dependencies: [
      {
        predecessorWorkItemId: 11,
        successorWorkItemId: 12,
        dependencyType: "FS",
        label: "#11 [end] -> #12 [start]"
      },
      {
        predecessorWorkItemId: 12,
        successorWorkItemId: 13,
        dependencyType: "FS",
        label: "#12 [end] -> #13 [start]"
      }
    ]
  };
}

export function makeFieldFilterTimeline(): TimelineReadModel {
  return {
    queryType: "flat",
    bars: [
      {
        workItemId: 11,
        title: "Alpha Platform",
        state: { code: "Active", badge: "A", color: "#2f855a" },
        schedule: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-03T00:00:00.000Z",
          missingBoundary: null
        },
        details: {
          mappedId: "11",
          fieldValues: {
            "Custom.Team": "Alpha",
            "Custom.Stream": "Platform"
          }
        }
      },
      {
        workItemId: 12,
        title: "Beta Platform",
        state: { code: "Active", badge: "A", color: "#2f855a" },
        schedule: {
          startDate: "2026-03-03T00:00:00.000Z",
          endDate: "2026-03-05T00:00:00.000Z",
          missingBoundary: null
        },
        details: {
          mappedId: "12",
          fieldValues: {
            "Custom.Team": "Beta",
            "Custom.Stream": "Platform"
          }
        }
      },
      {
        workItemId: 13,
        title: "Alpha Business",
        state: { code: "Active", badge: "A", color: "#2f855a" },
        schedule: {
          startDate: "2026-03-05T00:00:00.000Z",
          endDate: "2026-03-07T00:00:00.000Z",
          missingBoundary: null
        },
        details: {
          mappedId: "13",
          fieldValues: {
            "Custom.Team": "Alpha",
            "Custom.Stream": "Business"
          }
        }
      }
    ],
    unschedulable: [
      {
        workItemId: 22,
        title: "Unsched Beta",
        state: { code: "New", badge: "N", color: "#2b6cb0" },
        details: {
          mappedId: "22",
          fieldValues: {
            "Custom.Team": "Beta",
            "Custom.Stream": "Operations"
          }
        },
        reason: "missing-both-dates"
      }
    ],
    dependencies: [],
    suppressedDependencies: [],
    treeLayout: null,
    mappingValidation: {
      status: "valid",
      issues: []
    }
  };
}

export function extractPathPoints(pathValue: string | null): Array<{ x: number; y: number }> {
  if (!pathValue) {
    return [];
  }

  const segments = pathValue
    .replace(/^M\s*/, "")
    .split(" L ")
    .map((segment) => segment.trim());
  return segments
    .map((segment) => {
      const [xRaw, yRaw] = segment.split(/\s+/);
      const x = Number(xRaw);
      const y = Number(yRaw);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }
      return { x, y };
    })
    .filter((point): point is { x: number; y: number } => point !== null);
}

export function createDataTransferMock(): DataTransfer {
  const store = new Map<string, string>();
  return {
    dropEffect: "none",
    effectAllowed: "all",
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [],
    clearData: (format?: string) => {
      if (typeof format === "string") {
        store.delete(format);
      } else {
        store.clear();
      }
    },
    getData: (format: string) => store.get(format) ?? "",
    setData: (format: string, data: string) => {
      store.set(format, data);
    },
    setDragImage: () => undefined
  } as DataTransfer;
}
