import type { WriteCommand, WriteCommandResult } from "../dto/write-boundary/write-command.dto.js";
import type { WriteCommandPort } from "../ports/write-command.port.js";

export type SubmitWriteCommandInput = {
  command: WriteCommand;
  writeEnabled?: boolean;
};

export class SubmitWriteCommandUseCase {
  public constructor(private readonly port: WriteCommandPort) {}

  public async execute(input: SubmitWriteCommandInput): Promise<WriteCommandResult> {
    const writeEnabled = input.writeEnabled ?? false;

    if (!writeEnabled) {
      return {
        accepted: false,
        mode: "NO_OP",
        commandKind: input.command.kind,
        operationCount: countWriteCommandOperations(input.command),
        reasonCode: "WRITE_DISABLED"
      };
    }

    return this.port.submit(input.command);
  }
}

function countWriteCommandOperations(command: WriteCommand): number {
  if (command.kind === "WORK_ITEM_PATCH") {
    return command.operations.length;
  }

  return 1;
}
