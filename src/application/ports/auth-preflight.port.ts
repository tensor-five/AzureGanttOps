export type AuthPreflightStatus =
  | "READY"
  | "SESSION_EXPIRED"
  | "MISSING_EXTENSION"
  | "CONTEXT_MISMATCH"
  | "CLI_NOT_FOUND"
  | "UNKNOWN_ERROR";

export type AuthPreflightResult = {
  status: AuthPreflightStatus;
};

export type PreflightContext = {
  organization: string;
  project: string;
};

export interface AuthPreflightPort {
  check(context: PreflightContext): Promise<AuthPreflightResult>;
}
