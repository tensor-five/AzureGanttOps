import type { DiagnosticsEvent } from "../../application/dto/diagnostics/diagnostics-event.dto.js";
import type { DiagnosticsPort } from "../../application/ports/diagnostics.port.js";

export type StructuredDiagnosticsWriter = (payload: Record<string, unknown>) => void;

export class StructuredDiagnosticsAdapter implements DiagnosticsPort {
  public constructor(private readonly write: StructuredDiagnosticsWriter = defaultWriter) {}

  public async publish(event: DiagnosticsEvent): Promise<void> {
    this.write({
      event: "diagnostics",
      timestamp: event.timestamp,
      name: event.eventName,
      statusCode: event.statusCode,
      errorCode: event.errorCode,
      guidance: event.guidance,
      source: event.source,
      freshness: event.freshness,
      metadata: event.metadata ?? null
    });
  }
}

function defaultWriter(payload: Record<string, unknown>): void {
  console.info(JSON.stringify(payload));
}
