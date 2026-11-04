import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runAdapterContract } from "@openspaces/adapter-kit/contract";
import { EventCollector, FAKE_TRIGGERS } from "@openspaces/adapter-kit";
import { AdapterStartError, withCapabilities } from "@openspaces/core";
import { describe, expect, it } from "vitest";
import { createAcpAdapter } from "./acp-adapter.js";
import type { AcpManifest } from "./manifest.js";

const mock = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test-support",
  "mock-acp-agent.mjs",
);

function manifest(overrides: Partial<AcpManifest> = {}): AcpManifest {
  return {
    id: "mock-acp",
    displayName: "Mock ACP",
    command: process.execPath,
    args: [mock],
    versionArgs: [mock, "--version"],
    parseVersion: (output) => output.trim().split(" ")[1] ?? "",
    capabilities: withCapabilities({
      resume: true,
      approvals: true,
      interrupt: true,
      thinking: true,
    }),
    authHint: "Run `mock login`",
    ...overrides,
  };
}

runAdapterContract({
  name: "acp (mock agent over stdio)",
  createAdapter: () => createAcpAdapter(manifest()),
  cwd: () => process.cwd(),
  prompts: { simple: "hello", needsApproval: FAKE_TRIGGERS.approval, slow: FAKE_TRIGGERS.slow },
});

async function open(adapterManifest: AcpManifest, spec: { resumeExternalSessionId?: string } = {}) {
  const run = await createAcpAdapter(adapterManifest).start({ cwd: process.cwd(), ...spec });
  return { run, collector: new EventCollector(run) };
}

describe("acp adapter specifics", () => {
  it("probes version, support and readiness", async () => {
    expect(await createAcpAdapter(manifest()).probe()).toEqual({
      available: true,
      supported: true,
      version: "1.0.0",
    });
    expect(
      await createAcpAdapter(manifest({ isSupportedVersion: () => false })).probe(),
    ).toMatchObject({
      available: true,
      supported: false,
    });
    expect(
      await createAcpAdapter(
        manifest({ checkReady: async () => ({ ready: false, reason: "log in" }) }),
      ).probe(),
    ).toMatchObject({ supported: false, reason: "log in" });
    expect(
      await createAcpAdapter(manifest({ command: "no-such-binary-xyz" })).probe(),
    ).toMatchObject({
      available: false,
    });
  });

  it("returns the agent session id and resumes without replaying history", async () => {
    const first = await open(manifest());
    await first.collector.waitForType("session.started");
    expect(first.collector.events[0]).toMatchObject({ type: "session.started" });
    await first.run.close();

    const resumed = await open(manifest(), { resumeExternalSessionId: "old-session" });
    await resumed.collector.waitForType("session.started");
    expect(resumed.collector.events[0]).toEqual({
      type: "session.started",
      externalSessionId: "old-session",
    });
    await resumed.run.send({ text: "hi" });
    await resumed.collector.waitForType("turn.completed");
    expect(JSON.stringify(resumed.collector.events)).not.toContain("old history");
    await resumed.run.close();
  });

  it("turns usage updates into cost deltas and flushes the assistant message", async () => {
    const { run, collector } = await open(manifest());
    await run.send({ text: "hello" });
    await collector.waitForType("turn.completed");
    expect(collector.events.find((e) => e.type === "usage.reported")).toEqual({
      type: "usage.reported",
      costUsd: 0.01,
    });
    expect(collector.events.find((e) => e.type === "message.completed")).toMatchObject({
      text: "echo: hello",
    });
    await run.close();
  });

  it("reports tool results and honours rejection", async () => {
    const { run, collector } = await open(manifest());
    await run.send({ text: FAKE_TRIGGERS.approval });
    await collector.waitForType("approval.requested");
    const request = collector.events.find((e) => e.type === "approval.requested");
    if (request?.type !== "approval.requested") throw new Error("missing request");
    expect(request.options.map((o) => o.decision)).toEqual(["allow_once", "allow_session", "deny"]);
    await run.resolveApproval(request.approvalId, "deny");
    await collector.waitForType("turn.completed");
    expect(collector.events.find((e) => e.type === "tool.completed")).toMatchObject({
      status: "error",
      output: "rejected",
    });
    await run.close();
  });

  it("explains missing authentication with the manifest hint", async () => {
    const adapter = createAcpAdapter(manifest({ env: { MOCK_AUTH: "required" } }));
    await expect(adapter.start({ cwd: process.cwd() })).rejects.toThrow(AdapterStartError);
    await expect(adapter.start({ cwd: process.cwd() })).rejects.toThrow(/mock login/);
  });

  it("fails the session when the agent process dies", async () => {
    const { run, collector } = await open(manifest());
    await run.send({ text: "crash now" });
    await collector.settled();
    expect(collector.events.map((e) => e.type).slice(-2)).toEqual([
      "session.error",
      "session.ended",
    ]);
    expect(collector.events.at(-2)).toMatchObject({ code: "agent_exited", fatal: true });
    await run.close();
  });

  it("fails to start when the binary is missing", async () => {
    await expect(
      createAcpAdapter(manifest({ command: "no-such-binary-xyz" })).start({ cwd: process.cwd() }),
    ).rejects.toThrow(AdapterStartError);
  });
});
