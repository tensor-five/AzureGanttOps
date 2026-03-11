import type { QueryIntakeResponse } from "../../features/query-switching/query-intake.controller.js";

function normalizeWorkItemType(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function resolveStatePaletteSourceWorkItemId(timeline: QueryIntakeResponse["timeline"]): number | null {
  if (!timeline) {
    return null;
  }

  const firstBarId = timeline.bars[0]?.workItemId ?? null;
  if (typeof firstBarId === "number") {
    return firstBarId;
  }

  const firstUnscheduledId = timeline.unschedulable[0]?.workItemId ?? null;
  return typeof firstUnscheduledId === "number" ? firstUnscheduledId : null;
}

function collectStatePaletteSourceWorkItemsByType(timeline: QueryIntakeResponse["timeline"]): Map<string, number> {
  const result = new Map<string, number>();
  if (!timeline) {
    return result;
  }

  const register = (workItemId: number, workItemType: string | null | undefined): void => {
    const typeKey = normalizeWorkItemType(workItemType);
    if (!typeKey || result.has(typeKey)) {
      return;
    }

    result.set(typeKey, workItemId);
  };

  timeline.bars.forEach((bar) => {
    register(bar.workItemId, bar.details.workItemType);
  });
  timeline.unschedulable.forEach((item) => {
    register(item.workItemId, item.details.workItemType);
  });

  return result;
}

function normalizeAdoStateColor(color: string | null): string | null {
  if (!color) {
    return null;
  }

  const normalized = color.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? `#${normalized}` : null;
}

function buildStateColorLookup(states: Array<{ name: string; color: string | null }>): Map<string, string> {
  const colorByStateCode = new Map<string, string>();
  states.forEach((state) => {
    const name = state.name.trim().toLowerCase();
    const color = normalizeAdoStateColor(state.color);
    if (name.length > 0 && color) {
      colorByStateCode.set(name, color);
    }
  });

  return colorByStateCode;
}

function applyRuntimeStateColorsByType(
  timeline: QueryIntakeResponse["timeline"],
  stateColorsByType: ReadonlyMap<string, ReadonlyMap<string, string>>,
  fallbackStateColors: ReadonlyMap<string, string>
): QueryIntakeResponse["timeline"] {
  if (!timeline) {
    return timeline;
  }

  const resolveColor = (input: { stateCode: string; workItemType: string | null | undefined }): string | null => {
    const stateKey = input.stateCode.trim().toLowerCase();
    if (stateKey.length === 0) {
      return null;
    }

    const typeKey = normalizeWorkItemType(input.workItemType);
    const typeScoped = typeKey ? stateColorsByType.get(typeKey)?.get(stateKey) : null;
    return typeScoped ?? fallbackStateColors.get(stateKey) ?? null;
  };

  return {
    ...timeline,
    bars: timeline.bars.map((bar) => {
      const nextColor = resolveColor({
        stateCode: bar.state.code,
        workItemType: bar.details.workItemType
      });
      return nextColor ? { ...bar, state: { ...bar.state, color: nextColor } } : bar;
    }),
    unschedulable: timeline.unschedulable.map((item) => {
      const nextColor = resolveColor({
        stateCode: item.state.code,
        workItemType: item.details.workItemType
      });
      return nextColor ? { ...item, state: { ...item.state, color: nextColor } } : item;
    })
  };
}

export async function enrichResponseWithRuntimeStateColors(
  incoming: QueryIntakeResponse,
  fetchWorkItemStateOptions: (input: { targetWorkItemId: number }) => Promise<Array<{ name: string; color: string | null }>>
): Promise<QueryIntakeResponse> {
  try {
    const sourceByType = collectStatePaletteSourceWorkItemsByType(incoming.timeline);
    const stateColorsByType = new Map<string, Map<string, string>>();
    const fallbackStateColors = new Map<string, string>();

    if (sourceByType.size > 0) {
      await Promise.all(
        [...sourceByType.entries()].map(async ([typeKey, workItemId]) => {
          const stateOptions = await fetchWorkItemStateOptions({ targetWorkItemId: workItemId });
          const stateColors = buildStateColorLookup(stateOptions);
          if (stateColors.size === 0) {
            return;
          }

          stateColorsByType.set(typeKey, stateColors);
          stateColors.forEach((color, state) => {
            if (!fallbackStateColors.has(state)) {
              fallbackStateColors.set(state, color);
            }
          });
        })
      );
    } else {
      const fallbackSourceWorkItemId = resolveStatePaletteSourceWorkItemId(incoming.timeline);
      if (fallbackSourceWorkItemId !== null) {
        const stateOptions = await fetchWorkItemStateOptions({ targetWorkItemId: fallbackSourceWorkItemId });
        buildStateColorLookup(stateOptions).forEach((color, state) => {
          fallbackStateColors.set(state, color);
        });
      }
    }

    return {
      ...incoming,
      timeline: applyRuntimeStateColorsByType(incoming.timeline, stateColorsByType, fallbackStateColors)
    };
  } catch {
    return incoming;
  }
}
