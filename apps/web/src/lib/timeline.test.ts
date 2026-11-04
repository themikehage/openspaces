import type { AgentEvent, AgentEventBody } from "@openspaces/core";
import { describe, expect, it } from "vitest";
import {
  initialTimeline,
  pendingApprovals,
  reduceTimeline,
  type TimelineState,
} from "./timeline.js";

function run(bodies: AgentEventBody[]): TimelineState {
  return bodies.reduce<TimelineState>(
    (state, body, i) =>
      reduceTimeline(state, {
        ...body,
        id: i + 1,
        ts: 0,
        sessionId: "s",
        schemaVersion: 1,
      } as AgentEvent),
    initialTimeline,
  );
}

describe("reduceTimeline", () => {
  it("streams assistant text into one message and completes it", () => {
    const state = run([
      { type: "message.delta", messageId: "m", text: "He" },
      { type: "message.delta", messageId: "m", text: "llo" },
    ]);
    expect(state.items).toEqual([
      { kind: "message", id: "m", role: "assistant", text: "Hello", complete: false },
    ]);
    const done = reduceTimeline(state, {
      type: "message.completed",
      messageId: "m",
      role: "assistant",
      text: "Hello!",
      id: 3,
      ts: 0,
      sessionId: "s",
      schemaVersion: 1,
    });
    expect(done.items).toEqual([
      { kind: "message", id: "m", role: "assistant", text: "Hello!", complete: true },
    ]);
  });

  it("shows user prompts", () => {
    const state = run([{ type: "message.completed", messageId: "u", role: "user", text: "hi" }]);
    expect(state.items[0]).toMatchObject({ role: "user", text: "hi", complete: true });
  });

  it("merges consecutive thinking deltas", () => {
    const state = run([
      { type: "thinking.delta", text: "a" },
      { type: "thinking.delta", text: "b" },
    ]);
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ kind: "thinking", text: "ab" });
  });

  it("tracks a tool call from start to completion", () => {
    const state = run([
      { type: "tool.started", toolCallId: "t", name: "Bash", input: { command: "ls" } },
      { type: "tool.output", toolCallId: "t", chunk: "a\n" },
      { type: "tool.completed", toolCallId: "t", status: "ok" },
    ]);
    expect(state.items[0]).toMatchObject({ kind: "tool", status: "ok", output: "a\n" });
  });

  it("falls back to the completion output and marks errors", () => {
    const state = run([
      { type: "tool.started", toolCallId: "t", name: "Bash", input: {} },
      { type: "tool.completed", toolCallId: "t", status: "error", output: "denied" },
    ]);
    expect(state.items[0]).toMatchObject({ status: "error", output: "denied" });
  });

  it("tracks approvals until they are resolved", () => {
    const requested = run([
      {
        type: "approval.requested",
        approvalId: "a",
        title: "Run",
        options: [{ decision: "allow_once", label: "Allow" }],
      },
    ]);
    expect(pendingApprovals(requested.items)).toBe(1);
    const resolved = reduceTimeline(requested, {
      type: "approval.resolved",
      approvalId: "a",
      decision: "deny",
      id: 2,
      ts: 0,
      sessionId: "s",
      schemaVersion: 1,
    });
    expect(pendingApprovals(resolved.items)).toBe(0);
    expect(resolved.items[0]).toMatchObject({ decision: "deny" });
  });

  it("accumulates usage and ignores replayed events", () => {
    const state = run([
      { type: "usage.reported", inputTokens: 1, outputTokens: 2, costUsd: 0.5 },
      { type: "usage.reported", inputTokens: 3 },
    ]);
    expect(state.usage).toEqual({ inputTokens: 4, outputTokens: 2, costUsd: 0.5 });
    const replay = reduceTimeline(state, {
      type: "usage.reported",
      inputTokens: 100,
      id: 1,
      ts: 0,
      sessionId: "s",
      schemaVersion: 1,
    });
    expect(replay).toBe(state);
  });

  it("adds notices for errors, interrupts and the end of the session", () => {
    const state = run([
      { type: "session.error", code: "x", message: "boom", fatal: false },
      { type: "turn.completed", stopReason: "interrupted" },
      { type: "turn.completed", stopReason: "completed" },
      { type: "session.ended", reason: "closed" },
    ]);
    expect(state.items.map((i) => (i.kind === "notice" ? `${i.tone}:${i.text}` : i.kind))).toEqual([
      "error:boom",
      "info:Interrupted",
      "info:Session closed",
    ]);
  });
});
