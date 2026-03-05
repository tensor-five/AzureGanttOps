import type { DiagnosticsEvent } from "../dto/diagnostics/diagnostics-event.dto.js";

export interface DiagnosticsPort {
  publish(event: DiagnosticsEvent): Promise<void>;
}
