import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AcpManifest, ReadyCheck } from "@openspaces/adapter-acp";
import { withCapabilities } from "@openspaces/core";

const exec = promisify(execFile);

export const DEVIN_LOGIN_HINT = "Not logged in: run `devin auth login`";

export function parseDevinVersion(output: string): string {
  return /(\d+\.\d+\.\d+)/.exec(output)?.[1] ?? "";
}

export function isSupportedDevinVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version);
}

export function interpretAuthStatus(output: string): ReadyCheck {
  return /not logged in/i.test(output)
    ? { ready: false, reason: DEVIN_LOGIN_HINT }
    : { ready: true };
}

export function createDevinManifest(binary = "devin"): AcpManifest {
  return {
    id: "devin",
    displayName: "Devin CLI",
    command: binary,
    args: ["acp"],
    versionArgs: ["--version"],
    parseVersion: parseDevinVersion,
    isSupportedVersion: isSupportedDevinVersion,
    checkReady: async () => {
      try {
        const { stdout } = await exec(binary, ["auth", "status"], { timeout: 10_000 });
        return interpretAuthStatus(stdout);
      } catch {
        return { ready: false, reason: "Could not read the Devin login status" };
      }
    },
    authHint: DEVIN_LOGIN_HINT,
    defaultMode: "accept-edits",
    capabilities: withCapabilities({
      resume: true,
      approvals: true,
      interrupt: true,
      mcp: true,
      images: true,
      thinking: true,
    }),
  };
}
