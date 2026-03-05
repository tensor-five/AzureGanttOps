import type { WriteCommand, WriteCommandResult } from "../dto/write-boundary/write-command.dto.js";

export type WriteCommandPort = {
  submit: (command: WriteCommand) => Promise<WriteCommandResult>;
};
