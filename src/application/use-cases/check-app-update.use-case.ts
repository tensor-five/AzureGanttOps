import type {
  AppUpdateCheckResponse,
  AppUpdateCheckSource,
  AppUpdateUnavailableReason
} from "../../shared/project-meta/app-update-check.js";
import { compareSimpleSemver, parseSimpleSemver } from "../../shared/project-meta/version-comparison.js";
import type { AppVersionSourcePort } from "../ports/app-version-source.port.js";

export type CheckAppUpdateUseCaseParams = {
  currentVersion: string;
  versionSource: AppVersionSourcePort;
  now?: () => Date;
};

export class CheckAppUpdateUseCase {
  private readonly currentVersion: string;
  private readonly versionSource: AppVersionSourcePort;
  private readonly now: () => Date;
  private inFlight: Promise<AppUpdateCheckResponse> | null = null;

  constructor(params: CheckAppUpdateUseCaseParams) {
    this.currentVersion = params.currentVersion;
    this.versionSource = params.versionSource;
    this.now = params.now ?? (() => new Date());
  }

  execute(): Promise<AppUpdateCheckResponse> {
    if (this.inFlight) {
      return this.inFlight;
    }

    const inFlight = this.check()
      .finally(() => {
        if (this.inFlight === inFlight) {
          this.inFlight = null;
        }
      });

    this.inFlight = inFlight;
    return inFlight;
  }

  private async check(): Promise<AppUpdateCheckResponse> {
    const checkedAt = this.now().toISOString();
    const source = this.versionSource.source;

    if (!parseSimpleSemver(this.currentVersion)) {
      return unavailableResponse({
        currentVersion: this.currentVersion,
        checkedAt,
        source,
        reason: "current_version_malformed"
      });
    }

    let latestVersion: string;
    try {
      latestVersion = (await this.versionSource.loadLatestVersion()).trim();
    } catch {
      return unavailableResponse({
        currentVersion: this.currentVersion,
        checkedAt,
        source,
        reason: "version_source_failed"
      });
    }

    const comparison = compareSimpleSemver(latestVersion, this.currentVersion);
    if (!comparison) {
      return unavailableResponse({
        currentVersion: this.currentVersion,
        latestVersion,
        checkedAt,
        source,
        reason: "latest_version_malformed"
      });
    }

    return {
      status: comparison === "greater" ? "update_available" : "current",
      currentVersion: this.currentVersion,
      latestVersion,
      checkedAt,
      source
    };
  }
}

function unavailableResponse(params: {
  currentVersion: string;
  latestVersion?: string;
  checkedAt: string;
  source: AppUpdateCheckSource;
  reason: AppUpdateUnavailableReason;
}): AppUpdateCheckResponse {
  return {
    status: "unavailable",
    currentVersion: params.currentVersion,
    ...(params.latestVersion ? { latestVersion: params.latestVersion } : {}),
    checkedAt: params.checkedAt,
    source: params.source,
    reason: params.reason
  };
}
