import {
  transition,
  type AgentAdapter,
  type AgentEventBody,
  type SessionState,
} from "@openspaces/core";
import { agentEventBodySchema } from "@openspaces/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { EventCollector } from "./event-collector.js";

export interface ContractConfig {
  name: string;
  createAdapter: () => AgentAdapter | Promise<AgentAdapter>;
  cwd: () => string;
  prompts: {
    simple: string;
    needsApproval?: string;
    slow?: string;
  };
}

function replay(events: readonly AgentEventBody[], prompts: number): SessionState {
  let state: SessionState = "created";
  state = transition(state, { kind: "command", command: "start" });
  let remaining = prompts;
  for (const event of events) {
    if (event.type === "turn.started" && state === "idle" && remaining > 0) {
      state = transition(state, { kind: "command", command: "prompt" });
      remaining -= 1;
    }
    state = transition(state, { kind: "event", event });
  }
  return state;
}

export function runAdapterContract(config: ContractConfig): void {
  describe(`adapter contract: ${config.name}`, () => {
    const cleanups: Array<() => Promise<void>> = [];

    afterEach(async () => {
      while (cleanups.length > 0) await cleanups.pop()?.();
    });

    async function open() {
      const adapter = await config.createAdapter();
      const run = await adapter.start({ cwd: config.cwd() });
      const collector = new EventCollector(run);
      cleanups.push(async () => {
        await run.close();
        await collector.settled();
      });
      return { adapter, run, collector };
    }

    it("reports a usable probe and consistent identity", async () => {
      const adapter = await config.createAdapter();
      const probe = await adapter.probe();
      expect(adapter.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(adapter.displayName.length).toBeGreaterThan(0);
      expect(probe.available).toBe(true);
      expect(probe.supported).toBe(true);
    });

    it("emits session.started before anything else", async () => {
      const { collector } = await open();
      await collector.waitForType("session.started");
      expect(collector.events[0]?.type).toBe("session.started");
    });

    it("completes a simple turn with valid, state-machine-compatible events", async () => {
      const { run, collector } = await open();
      await collector.waitForType("session.started");
      await run.send({ text: config.prompts.simple });
      await collector.waitForType("turn.completed");

      const types = collector.events.map((e) => e.type);
      expect(types).toContain("turn.started");
      expect(types.indexOf("turn.started")).toBeLessThan(types.indexOf("turn.completed"));
      const completed = collector.events.find((e) => e.type === "message.completed");
      expect(completed).toMatchObject({ role: "assistant" });
      for (const event of collector.events) agentEventBodySchema.parse(event);
      expect(replay(collector.events, 1)).toBe("idle");
    });

    it("supports a second turn on the same run", async () => {
      const { run, collector } = await open();
      await collector.waitForType("session.started");
      await run.send({ text: config.prompts.simple });
      await collector.waitForType("turn.completed");
      const mark = collector.events.length;
      await run.send({ text: config.prompts.simple });
      await collector.waitFor((events) =>
        events.slice(mark).some((e) => e.type === "turn.completed"),
      );
      expect(replay(collector.events, 2)).toBe("idle");
    });

    it("ends cleanly on close, idempotently, and rejects later input", async () => {
      const { run, collector } = await open();
      await collector.waitForType("session.started");
      await run.close();
      await run.close();
      await collector.settled();
      expect(collector.events.at(-1)).toMatchObject({ type: "session.ended" });
      await expect(run.send({ text: config.prompts.simple })).rejects.toThrow();
    });

    it("exposes capabilities as plain booleans", async () => {
      const adapter = await config.createAdapter();
      for (const value of Object.values(adapter.capabilities)) {
        expect(typeof value).toBe("boolean");
      }
    });

    it("runs the approval flow when it advertises approvals", async (ctx) => {
      const adapter = await config.createAdapter();
      const prompt = config.prompts.needsApproval;
      if (!adapter.capabilities.approvals || !prompt) return ctx.skip();
      const { run, collector } = await open();
      await collector.waitForType("session.started");
      await run.send({ text: prompt });
      await collector.waitForType("approval.requested");
      const request = collector.events.find((e) => e.type === "approval.requested");
      if (request?.type !== "approval.requested") throw new Error("missing approval request");
      expect(request.options.length).toBeGreaterThan(0);
      await run.resolveApproval(request.approvalId, "allow_once");
      await collector.waitForType("turn.completed");
      expect(collector.events.some((e) => e.type === "approval.resolved")).toBe(true);
      expect(replay(collector.events, 1)).toBe("idle");
    });

    it("honours a denied approval", async (ctx) => {
      const adapter = await config.createAdapter();
      const prompt = config.prompts.needsApproval;
      if (!adapter.capabilities.approvals || !prompt) return ctx.skip();
      const { run, collector } = await open();
      await collector.waitForType("session.started");
      await run.send({ text: prompt });
      await collector.waitForType("approval.requested");
      const request = collector.events.find((e) => e.type === "approval.requested");
      if (request?.type !== "approval.requested") throw new Error("missing approval request");
      await run.resolveApproval(request.approvalId, "deny");
      await collector.waitForType("turn.completed");
      const resolved = collector.events.find((e) => e.type === "approval.resolved");
      expect(resolved).toMatchObject({ decision: "deny" });
    });

    it("interrupts a running turn when it advertises interrupt", async (ctx) => {
      const adapter = await config.createAdapter();
      const prompt = config.prompts.slow;
      if (!adapter.capabilities.interrupt || !prompt) return ctx.skip();
      const { run, collector } = await open();
      await collector.waitForType("session.started");
      await run.send({ text: prompt });
      await collector.waitForType("turn.started");
      await run.interrupt();
      await collector.waitForType("turn.completed");
      const done = collector.events.find((e) => e.type === "turn.completed");
      expect(done).toMatchObject({ stopReason: "interrupted" });
    });
  });
}
