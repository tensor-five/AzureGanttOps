import type {
  DiagnosticsEvent,
  DiagnosticsMetadataValue
} from "../dto/diagnostics/diagnostics-event.dto.js";
import type { DiagnosticsPort } from "../ports/diagnostics.port.js";

const FORBIDDEN_METADATA_KEYS = new Set(["accesstoken", "authorization", "token", "refreshtoken", "idtoken"]);
const TOKEN_LIKE_VALUE = /(bearer\s+[a-z0-9._-]+|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.?[a-zA-Z0-9_-]*|ghp_[a-zA-Z0-9]+)/i;

export class PublishDiagnosticsUseCase {
  public constructor(private readonly diagnostics: DiagnosticsPort) {}

  public async execute(event: DiagnosticsEvent): Promise<void> {
    await this.diagnostics.publish({
      ...event,
      guidance: sanitizeString(event.guidance),
      metadata: sanitizeMetadata(event.metadata)
    });
  }
}

function sanitizeMetadata(
  metadata: Readonly<Record<string, DiagnosticsMetadataValue>> | undefined
): Readonly<Record<string, DiagnosticsMetadataValue>> | undefined {
  if (!metadata) {
    return undefined;
  }

  const entries = Object.entries(metadata)
    .filter(([key]) => !FORBIDDEN_METADATA_KEYS.has(key.toLowerCase()))
    .filter(([, value]) => (typeof value === "number" ? Number.isFinite(value) : true))
    .map(([key, value]) => [key, typeof value === "string" ? sanitizeString(value) : value] as const);

  return Object.fromEntries(entries);
}

function sanitizeString(value: string): string {
  if (TOKEN_LIKE_VALUE.test(value)) {
    return "[REDACTED]";
  }

  return value;
}
