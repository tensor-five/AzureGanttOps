export type CanonicalTaskState = {
  code: string;
  badge: string;
  color: string;
};

export type CanonicalTask = {
  workItemId: number;
  mappedId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  state: CanonicalTaskState;
};
