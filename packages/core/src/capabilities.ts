export interface AdapterCapabilities {
  resume: boolean;
  approvals: boolean;
  interrupt: boolean;
  mcp: boolean;
  images: boolean;
  thinking: boolean;
}

export const NO_CAPABILITIES: AdapterCapabilities = {
  resume: false,
  approvals: false,
  interrupt: false,
  mcp: false,
  images: false,
  thinking: false,
};

export function withCapabilities(overrides: Partial<AdapterCapabilities>): AdapterCapabilities {
  return { ...NO_CAPABILITIES, ...overrides };
}
