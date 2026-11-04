import {
  NotResumableError,
  SessionLimitError,
  SessionNotLiveError,
  withCapabilities,
  type AgentAdapter,
  type AgentEvent,
  type AgentEventBody,
  type Workspace,
  type WorkspaceProvider,
} from "@openspaces/core";
import { describe, expect, it } from "vitest";
import { build, until } from "./service-harness.js";
import { EventChannel } from "./event-channel.js";
import { createFakeAgent, FAKE_TRIGGERS } from "./fake-agent.js";

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
    expect(events.find((e) => e.type === "message.completed" && e.role === "user")).toMatchObject({
      text: "hello",
    });
    const types = events.map((e) => e.type);
    expect(types.indexOf("message.completed")).toBeLessThan(types.indexOf("turn.started"));
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

  it("refuses to start sessions on adapters that are not ready", async () => {
    const notReady: AgentAdapter = {
      ...createFakeAgent(),
      id: "not-ready",
      probe: async () => ({ available: true, supported: false, reason: "log in first" }),
    };
    const { service } = build(notReady);
    await expect(service.create({ adapterId: "not-ready", cwd: "/tmp" })).rejects.toThrow(
      /log in first/,
    );
    expect(await service.list()).toEqual([]);
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

  it("enforces the live session limit and frees slots when sessions end", async () => {
    const { service } = build(createFakeAgent(), { maxLiveSessions: 1 });
    const first = await service.create({ adapterId: "fake", cwd: "/tmp" });
    await expect(service.create({ adapterId: "fake", cwd: "/tmp" })).rejects.toThrow(
      SessionLimitError,
    );
    await service.close(first.id);
    await until(() => service.liveCount() === 0);
    const second = await service.create({ adapterId: "fake", cwd: "/tmp" });
    expect(second.state).toBe("idle");
    await service.close(second.id);
  });

  it("marks a session failed when the adapter cannot start", async () => {
    const broken: AgentAdapter = {
      ...createFakeAgent(),
      id: "broken",
      start: async () => {
        throw new Error("spawn failed");
      },
    };
    const { service } = build(broken);
    await expect(service.create({ adapterId: "broken", cwd: "/tmp" })).rejects.toThrow(
      /spawn failed/,
    );
    const [record] = await service.list();
    expect(record?.state).toBe("failed");
    expect((await service.events(record?.id ?? "")).at(-1)).toMatchObject({
      code: "start_failed",
    });
  });

  it("recovers sessions left active by a previous daemon run", async () => {
    const { service, store } = build();
    await store.create({
      id: "old",
      adapterId: "fake",
      cwd: "/tmp",
      state: "running",
      createdAt: 1,
      updatedAt: 1,
    });
    expect(await service.recover()).toBe(1);
    expect((await store.get("old"))?.state).toBe("failed");
    const types = (await store.readEvents("old")).map((e) => e.type);
    expect(types).toEqual(["session.error", "session.ended"]);
    expect(await service.recover()).toBe(0);
  });

  it("resumes ended sessions with the stored agent session id", async () => {
    const seen: Array<string | undefined> = [];
    const adapter: AgentAdapter = {
      ...createFakeAgent(),
      capabilities: withCapabilities({ resume: true }),
      start: async (spec) => {
        seen.push(spec.resumeExternalSessionId);
        return createFakeAgent().start(spec);
      },
    };
    const { service } = build(adapter);
    const first = await service.create({ adapterId: "fake", cwd: "/tmp/p" });
    await expect(service.resume(first.id)).rejects.toThrow(NotResumableError);
    await service.close(first.id);
    await until(async () => (await service.get(first.id))?.state === "ended");
    const next = await service.resume(first.id);
    expect(next.id).not.toBe(first.id);
    expect(next.cwd).toBe("/tmp/p");
    expect(seen).toEqual([undefined, "fake-session"]);
    await service.closeAll();
  });

  it("refuses to resume agents without resume support", async () => {
    const { service } = build();
    const session = await service.create({ adapterId: "fake", cwd: "/tmp" });
    await service.close(session.id);
    await until(async () => (await service.get(session.id))?.state === "ended");
    await expect(service.resume(session.id)).rejects.toThrow(/does not support/);
  });

  it("creates a worktree workspace and disposes it when the session ends", async () => {
    const events: string[] = [];
    const workspaces: WorkspaceProvider = {
      create: async (spec): Promise<Workspace> => {
        events.push(`create:${spec.projectPath}:${spec.mode}`);
        return { path: "/tmp/wt", dispose: async () => void events.push("dispose") };
      },
    };
    const { service } = build(createFakeAgent(), { workspaces });
    const session = await service.create({
      adapterId: "fake",
      cwd: "/tmp/project",
      workspaceMode: "worktree",
    });
    expect(session).toMatchObject({
      cwd: "/tmp/wt",
      projectPath: "/tmp/project",
      workspace: "worktree",
    });
    await service.close(session.id);
    expect(events).toEqual(["create:/tmp/project:worktree", "dispose"]);
  });

  it("rejects worktree sessions when no provider is configured", async () => {
    const { service } = build();
    await expect(
      service.create({ adapterId: "fake", cwd: "/tmp", workspaceMode: "worktree" }),
    ).rejects.toThrow(/not configured/);
  });

  it("closes every live session on shutdown", async () => {
    const { service } = build();
    const a = await service.create({ adapterId: "fake", cwd: "/tmp" });
    const b = await service.create({ adapterId: "fake", cwd: "/tmp" });
    await service.closeAll();
    await until(() => service.liveCount() === 0);
    expect((await service.get(a.id))?.state).toBe("ended");
    expect((await service.get(b.id))?.state).toBe("ended");
  });
});
