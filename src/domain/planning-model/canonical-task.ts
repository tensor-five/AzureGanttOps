export type CanonicalTaskState = {
  code: string;
  badge: string;
  color: string;
};

export type CanonicalTask = {
  workItemId: number;
  mappedId: string;
  title: string;
  descriptionHtml: string | null;
  workItemType: string | null;
  fieldValues: Record<string, string | number | null>;
  assignedTo: string | null;
  parentWorkItemId: number | null;
  startDate: string | null;
  endDate: string | null;
  state: CanonicalTaskState;
};
