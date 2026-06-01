export function buildAzureWorkItemUrl(
  organization: string | undefined | null,
  project: string | undefined | null,
  workItemId: number | undefined | null
): string | null {
  const trimmedOrg = organization?.trim();
  const trimmedProject = project?.trim();
  if (!trimmedOrg || !trimmedProject || typeof workItemId !== "number" || !Number.isFinite(workItemId) || workItemId <= 0) {
    return null;
  }

  return `https://dev.azure.com/${encodeURIComponent(trimmedOrg)}/${encodeURIComponent(trimmedProject)}/_workitems/edit/${workItemId}`;
}
