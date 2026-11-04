import { runAdapterContract } from "@openspaces/adapter-kit/contract";
import { describe, it } from "vitest";
import { createDevinAdapter } from "./devin-adapter.js";

const live = process.env["OPENSPACES_LIVE"]?.split(",").includes("devin") ?? false;

if (live) {
  runAdapterContract({
    name: "devin (live)",
    createAdapter: () => createDevinAdapter(),
    cwd: () => process.cwd(),
    prompts: { simple: "Reply with exactly the word: ok" },
  });
} else {
  describe("adapter contract: devin (live)", () => {
    it.skip("set OPENSPACES_LIVE=devin to run against the real CLI", () => {});
  });
}
