import type { WriteCommand, WriteCommandResult } from "../../../application/dto/write-boundary/write-command.dto.js";
import type { WriteCommandPort } from "../../../application/ports/write-command.port.js";

export class WriteCommandNoopAdapter implements WriteCommandPort {
  public async submit(command: WriteCommand): Promise<WriteCommandResult> {
    return {
      accepted: false,
      mode: "NO_OP",
      commandKind: command.kind,
      operationCount: command.kind === "WORK_ITEM_PATCH" ? command.operations.length : 1,
      reasonCode: "WRITE_DISABLED"
    };
  }
}
