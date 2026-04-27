export function buildAzureQueryUrl(
  organization: string | undefined | null,
  project: string | undefined | null,
  queryId: string | undefined | null
): string | null {
  const trimmedOrg = organization?.trim();
  const trimmedProject = project?.trim();
  const trimmedQueryId = queryId?.trim();
  if (!trimmedOrg || !trimmedProject || !trimmedQueryId) {
    return null;
  }
  return `https://dev.azure.com/${encodeURIComponent(trimmedOrg)}/${encodeURIComponent(trimmedProject)}/_queries/query/${encodeURIComponent(trimmedQueryId)}`;
}
