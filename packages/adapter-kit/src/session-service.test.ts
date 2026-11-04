import {
  AdapterRegistry,
  MemorySessionStore,
  SessionNotLiveError,
  SessionService,
  withCapabilities,
  type AgentAdapter,
  type AgentEvent,
  type AgentEventBody,
  type Logger,
} from "@openspaces/core";
import { describe, expect, it } from "vitest";
import { EventChannel } from "./event-channel.js";
import { createFakeAgent, FAKE_TRIGGERS } from "./fake-agent.js";

const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };

function build(adapter: AgentAdapter = createFakeAgent()) {
  let n = 0;
  const registry = new AdapterRegistry();
  registry.register(adapter);
  const store = new MemorySessionStore();
  const service = new SessionService({
    registry,
    store,
    clock: { now: () => ++n },
    ids: { next: () => `s${++n}` },
    logger: silent,
  });
  return { service, store };
}

async function until(check: () => Promise<boolean> | boolean, ms = 2000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("condition not met");
}

describe("SessionService", () => {
  it("creates an idle session and persists stamped events", async () => {
    const { service } = build();
    const session = await service.create({ adapterId: "fake", cwd: "/tmp" });
    expect(session.state).toBe("idle");
    expect(session.externalSessionId).toBe("fake-session");

    await service.prompt(session.id, "hello");
    await until(
      async () =>
        (await service.get(session.id))?.state === "idle" &&
        (await service.events(session.id)).some((e) => e.type === "turn.completed"),
    );

    const events = await service.events(session.id);
    expect(events.map((e) => e.id)).toEqual(events.map((_, i) => i + 1));
    expect(events.every((e) => e.schemaVersion === 1)).toBe(true);
    await service.close(session.id);
  });

  it("walks through approval states and notifies subscribers", async () => {
    const { service } = build();
    const session = await service.create({ adapterId: "fake", cwd: "/tmp" });
    const seen: AgentEvent[] = [];
    service.subscribe(session.id, (e) => seen.push(e));

    await service.prompt(session.id, FAKE_TRIGGERS.approval);
    await until(async () => (await service.get(session.id))?.state === "awaiting_approval");
    const request = seen.find((e) => e.type === "approval.requested");
    if (request?.type !== "approval.requested") throw new Error("no request");

    await service.resolveApproval(session.id, request.approvalId, "allow_once");
    await until(() => seen.some((e) => e.type === "turn.completed"));
    await until(async () => (await service.get(session.id))?.state === "idle");
    await service.close(session.id);
  });

  it("interrupts a slow turn", async () => {
    const { service } = build();
    const session = await service.create({ adapterId: "fake", cwd: "/tmp" });
    const seen: AgentEvent[] = [];
    service.subscribe(session.id, (e) => seen.push(e));
    await service.prompt(session.id, FAKE_TRIGGERS.slow);
    await until(() => seen.some((e) => e.type === "turn.started"));
    await service.interrupt(session.id);
    await until(() => seen.some((e) => e.type === "turn.completed"));
    expect(seen.find((e) => e.type === "turn.completed")).toMatchObject({
      stopReason: "interrupted",
    });
    await service.close(session.id);
  });

  it("ends the session on close and then refuses input", async () => {
    const { service } = build();
    const session = await service.create({ adapterId: "fake", cwd: "/tmp" });
    await service.close(session.id);
    expect((await service.get(session.id))?.state).toBe("ended");
    await expect(service.prompt(session.id, "x")).rejects.toThrow(SessionNotLiveError);
  });

  it("rejects prompts while a turn is running", async () => {
    const { service } = build();
    const session = await service.create({ adapterId: "fake", cwd: "/tmp" });
    await service.prompt(session.id, FAKE_TRIGGERS.slow);
    await expect(service.prompt(session.id, "again")).rejects.toThrow(/Cannot apply/);
    await service.close(session.id);
  });

  it("fails the session when an adapter violates the protocol", async () => {
    const channel = new EventChannel<AgentEventBody>();
    channel.push({ type: "session.started" });
    const rogue: AgentAdapter = {
      id: "rogue",
      displayName: "Rogue",
      capabilities: withCapabilities({}),
      probe: async () => ({ available: true, supported: true }),
      start: async () => ({
        events: channel,
        send: async () => {
          channel.push({ type: "approval.resolved", approvalId: "x", decision: "deny" });
        },
        interrupt: async () => {},
        resolveApproval: async () => {},
        close: async () => channel.end(),
      }),
    };
    const { service } = build(rogue);
    const session = await service.create({ adapterId: "rogue", cwd: "/tmp" });
    await service.prompt(session.id, "go");
    await until(async () => (await service.get(session.id))?.state === "failed");
    const events = await service.events(session.id);
    expect(events.at(-1)).toMatchObject({ type: "session.error", code: "protocol_violation" });
  });

  it("fails the session when the stream ends without a session.ended", async () => {
    const channel = new EventChannel<AgentEventBody>();
    channel.push({ type: "session.started" });
    const flaky: AgentAdapter = {
      id: "flaky",
      displayName: "Flaky",
      capabilities: withCapabilities({}),
      probe: async () => ({ available: true, supported: true }),
      start: async () => ({
        events: channel,
        send: async () => channel.end(),
        interrupt: async () => {},
        resolveApproval: async () => {},
        close: async () => {},
      }),
    };
    const { service } = build(flaky);
    const session = await service.create({ adapterId: "flaky", cwd: "/tmp" });
    await service.prompt(session.id, "go");
    await until(async () => (await service.get(session.id))?.state === "failed");
  });
});
