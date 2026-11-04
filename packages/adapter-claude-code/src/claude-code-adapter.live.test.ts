import { runAdapterContract } from "@openspaces/adapter-kit/contract";
import { describe, it } from "vitest";
import { createClaudeCodeAdapter } from "./claude-code-adapter.js";

const live = process.env["OPENSPACES_LIVE"]?.split(",").includes("claude-code") ?? false;

if (live) {
  runAdapterContract({
    name: "claude-code (live)",
    createAdapter: () => createClaudeCodeAdapter(),
    cwd: () => process.cwd(),
    prompts: { simple: "Reply with exactly the word: ok" },
  });
} else {
  describe("adapter contract: claude-code (live)", () => {
    it.skip("set OPENSPACES_LIVE=claude-code to run against the real CLI", () => {});
  });
}
