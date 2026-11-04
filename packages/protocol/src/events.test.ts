import type { AgentEventBody } from "@openspaces/core";
import { describe, expect, it } from "vitest";
import { agentEventBodySchema, agentEventSchema } from "./events.js";

const samples: AgentEventBody[] = [
  { type: "session.started", externalSessionId: "x" },
  { type: "turn.started" },
  { type: "turn.completed", stopReason: "completed" },
  { type: "message.delta", messageId: "m", text: "hi" },
  { type: "message.completed", messageId: "m", role: "assistant", text: "hi" },
  { type: "thinking.delta", text: "hmm" },
  { type: "tool.started", toolCallId: "t", name: "bash", input: { cmd: "ls" } },
  { type: "tool.output", toolCallId: "t", chunk: "a" },
  { type: "tool.completed", toolCallId: "t", status: "ok", output: "a" },
  {
    type: "approval.requested",
    approvalId: "a",
    title: "Run ls",
    options: [{ decision: "allow_once", label: "Allow" }],
  },
  { type: "approval.resolved", approvalId: "a", decision: "deny" },
  { type: "usage.reported", inputTokens: 1, outputTokens: 2, costUsd: 0.01 },
  { type: "session.error", code: "c", message: "m", fatal: false },
  { type: "session.ended", reason: "closed" },
];

describe("event schemas", () => {
  it.each(samples)("accepts body %j", (body) => {
    expect(agentEventBodySchema.parse(body)).toEqual(body);
  });

  it("accepts a stamped event", () => {
    const event = { type: "turn.started", id: 1, ts: 5, sessionId: "s", schemaVersion: 1 };
    expect(agentEventSchema.parse(event)).toMatchObject(event);
  });

  it("rejects unknown types and wrong schema versions", () => {
    expect(() => agentEventBodySchema.parse({ type: "nope" })).toThrow();
    expect(() =>
      agentEventSchema.parse({
        type: "turn.started",
        id: 1,
        ts: 5,
        sessionId: "s",
        schemaVersion: 2,
      }),
    ).toThrow();
  });
});
