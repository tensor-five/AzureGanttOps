import React from "react";

import type { ScheduleOverride } from "./timeline-schedule-overrides.js";

export type DragMode = "move" | "resize-start" | "resize-end";

export type ActiveScheduleDrag = {
  mode: DragMode;
  pointerId: number;
  workItemId: number;
  originClientX: number;
  originScrollLeft: number;
  startDate: Date;
  endDate: Date;
  sourceStartDateIso?: string | null;
  sourceEndDateIso?: string | null;
  lastDayDelta: number;
};

export type ActiveUnschedulableDrag = {
  workItemId: number;
  fixedEndDateIso: string | null;
  fixedEndTimelineDate: Date | null;
};

export type UnscheduledDropPreview = {
  startDate: Date;
  endDate: Date;
};

export function useScheduleDragging(): {
  adoptedSchedulesByWorkItemId: Record<number, { startDate: string | null; endDate: string | null }>;
  setAdoptedSchedulesByWorkItemId: React.Dispatch<
    React.SetStateAction<Record<number, { startDate: string | null; endDate: string | null }>>
  >;
  editedBarSchedulesByWorkItemId: Record<number, ScheduleOverride>;
  setEditedBarSchedulesByWorkItemId: React.Dispatch<
    React.SetStateAction<Record<number, ScheduleOverride>>
  >;
  adoptScheduleError: string | null;
  setAdoptScheduleError: React.Dispatch<React.SetStateAction<string | null>>;
  activeScheduleDrag: ActiveScheduleDrag | null;
  setActiveScheduleDrag: React.Dispatch<React.SetStateAction<ActiveScheduleDrag | null>>;
  activeUnschedulableDrag: ActiveUnschedulableDrag | null;
  setActiveUnschedulableDrag: React.Dispatch<React.SetStateAction<ActiveUnschedulableDrag | null>>;
  unscheduledDropPreview: UnscheduledDropPreview | null;
  setUnscheduledDropPreview: React.Dispatch<React.SetStateAction<UnscheduledDropPreview | null>>;
} {
  const [adoptedSchedulesByWorkItemId, setAdoptedSchedulesByWorkItemId] = React.useState<
    Record<number, { startDate: string | null; endDate: string | null }>
  >({});
  const [editedBarSchedulesByWorkItemId, setEditedBarSchedulesByWorkItemId] = React.useState<Record<number, ScheduleOverride>>({});
  const [adoptScheduleError, setAdoptScheduleError] = React.useState<string | null>(null);
  const [activeScheduleDrag, setActiveScheduleDrag] = React.useState<ActiveScheduleDrag | null>(null);
  const [activeUnschedulableDrag, setActiveUnschedulableDrag] = React.useState<ActiveUnschedulableDrag | null>(null);
  const [unscheduledDropPreview, setUnscheduledDropPreview] = React.useState<UnscheduledDropPreview | null>(null);

  return {
    adoptedSchedulesByWorkItemId,
    setAdoptedSchedulesByWorkItemId,
    editedBarSchedulesByWorkItemId,
    setEditedBarSchedulesByWorkItemId,
    adoptScheduleError,
    setAdoptScheduleError,
    activeScheduleDrag,
    setActiveScheduleDrag,
    activeUnschedulableDrag,
    setActiveUnschedulableDrag,
    unscheduledDropPreview,
    setUnscheduledDropPreview
  };
}
