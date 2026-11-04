import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  withCapabilities,
  type AdapterProbe,
  type AgentAdapter,
  type AgentRun,
  type AgentStartSpec,
} from "@openspaces/core";
import { ClaudeRun } from "./claude-run.js";
import { sdkQuery, type QueryFn } from "./types.js";

const exec = promisify(execFile);

export interface ClaudeCodeAdapterOptions {
  queryFn?: QueryFn;
  binary?: string;
  readVersion?: () => Promise<string>;
  minMajor?: number;
}

export function createClaudeCodeAdapter(options: ClaudeCodeAdapterOptions = {}): AgentAdapter {
  const queryFn = options.queryFn ?? sdkQuery;
  const binary = options.binary ?? "claude";
  const minMajor = options.minMajor ?? 2;
  const readVersion =
    options.readVersion ??
    (async () => (await exec(binary, ["--version"], { timeout: 10_000 })).stdout);
  return {
    id: "claude-code",
    displayName: "Claude Code",
    capabilities: withCapabilities({
      resume: true,
      approvals: true,
      interrupt: true,
      mcp: true,
      images: true,
      thinking: true,
    }),
    async probe(): Promise<AdapterProbe> {
      try {
        const version = (await readVersion()).trim().split(/\s+/)[0] ?? "";
        const major = Number.parseInt(version.split(".")[0] ?? "", 10);
        if (Number.isNaN(major) || major < minMajor) {
          return {
            available: true,
            supported: false,
            version,
            reason: `Claude Code ${minMajor}.x or newer is required`,
          };
        }
        return { available: true, supported: true, version };
      } catch {
        return {
          available: false,
          supported: false,
          reason: `"${binary}" was not found or did not run`,
        };
      }
    },
    start: async (spec: AgentStartSpec): Promise<AgentRun> => new ClaudeRun(queryFn, spec),
  };
}
