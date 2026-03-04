const QUERY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class QueryId {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value.toLowerCase();
  }

  public static create(input: string): QueryId {
    const normalized = input.trim();

    if (!QUERY_ID_PATTERN.test(normalized)) {
      throw new Error("Use a valid query ID.");
    }

    return new QueryId(normalized);
  }
}
