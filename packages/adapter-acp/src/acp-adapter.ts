import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AdapterProbe, AgentAdapter, AgentRun, AgentStartSpec } from "@openspaces/core";
import { AcpRun } from "./acp-run.js";
import type { AcpManifest } from "./manifest.js";

const exec = promisify(execFile);

export function createAcpAdapter(manifest: AcpManifest): AgentAdapter {
  return {
    id: manifest.id,
    displayName: manifest.displayName,
    capabilities: manifest.capabilities,
    async probe(): Promise<AdapterProbe> {
      let output: string;
      try {
        output = (await exec(manifest.command, [...manifest.versionArgs], { timeout: 10_000 }))
          .stdout;
      } catch {
        return {
          available: false,
          supported: false,
          reason: `"${manifest.command}" was not found or did not run`,
        };
      }
      const version = (manifest.parseVersion ?? ((text) => text.trim()))(output);
      if (manifest.isSupportedVersion && !manifest.isSupportedVersion(version)) {
        return {
          available: true,
          supported: false,
          version,
          reason: `Version ${version} is not supported`,
        };
      }
      const ready = (await manifest.checkReady?.()) ?? { ready: true };
      return ready.ready
        ? { available: true, supported: true, version }
        : { available: true, supported: false, version, reason: ready.reason ?? "Not ready" };
    },
    start: (spec: AgentStartSpec): Promise<AgentRun> => AcpRun.start(manifest, spec),
  };
}
