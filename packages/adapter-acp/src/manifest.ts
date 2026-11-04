import type { AdapterCapabilities } from "@openspaces/core";

export interface ReadyCheck {
  ready: boolean;
  reason?: string;
}

export interface AcpManifest {
  id: string;
  displayName: string;
  command: string;
  args: readonly string[];
  versionArgs: readonly string[];
  capabilities: AdapterCapabilities;
  parseVersion?: (output: string) => string;
  isSupportedVersion?: (version: string) => boolean;
  checkReady?: () => Promise<ReadyCheck>;
  authHint?: string;
  defaultMode?: string;
  env?: Readonly<Record<string, string>>;
}
