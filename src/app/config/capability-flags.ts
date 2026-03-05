export type CapabilityFlags = {
  writeEnabled: boolean;
};

export const V1_CAPABILITY_DEFAULTS: CapabilityFlags = {
  writeEnabled: false
};

export function resolveCapabilityFlags(overrides?: Partial<CapabilityFlags>): CapabilityFlags {
  return {
    writeEnabled: overrides?.writeEnabled ?? V1_CAPABILITY_DEFAULTS.writeEnabled
  };
}
