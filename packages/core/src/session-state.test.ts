import { describe, expect, it } from "vitest";
import { InvalidTransitionError } from "./errors.js";
import type { AgentEventBody } from "./events.js";
import { isTerminal, transition, type SessionInput, type SessionState } from "./session-state.js";

const cmd = (command: "start" | "prompt" | "interrupt" | "close"): SessionInput => ({
  kind: "command",
  command,
});
const evt = (event: AgentEventBody): SessionInput => ({ kind: "event", event });

const started = evt({ type: "session.started" });
const approval = evt({
  type: "approval.requested",
  approvalId: "a1",
  title: "Run ls",
  options: [{ decision: "allow_once", label: "Allow" }],
});
const resolved = evt({ type: "approval.resolved", approvalId: "a1", decision: "allow_once" });
const turnDone = evt({ type: "turn.completed", stopReason: "completed" });
const fatal = evt({ type: "session.error", code: "boom", message: "x", fatal: true });
const soft = evt({ type: "session.error", code: "warn", message: "x", fatal: false });
const delta = evt({ type: "message.delta", messageId: "m", text: "hi" });

const valid: Array<[SessionState, SessionInput, SessionState]> = [
  ["created", cmd("start"), "starting"],
  ["starting", started, "idle"],
  ["starting", fatal, "failed"],
  ["starting", cmd("close"), "ended"],
  ["idle", cmd("prompt"), "running"],
  ["idle", cmd("close"), "ended"],
  ["idle", soft, "idle"],
  ["running", delta, "running"],
  ["running", approval, "awaiting_approval"],
  ["running", turnDone, "idle"],
  ["running", cmd("interrupt"), "running"],
  ["running", fatal, "failed"],
  ["running", evt({ type: "session.ended", reason: "completed" }), "ended"],
  ["running", evt({ type: "session.ended", reason: "failed" }), "failed"],
  ["running", cmd("close"), "ended"],
  ["awaiting_approval", resolved, "running"],
  ["awaiting_approval", turnDone, "idle"],
  ["awaiting_approval", cmd("interrupt"), "awaiting_approval"],
  ["awaiting_approval", delta, "awaiting_approval"],
  ["awaiting_approval", fatal, "failed"],
];

const invalid: Array<[SessionState, SessionInput]> = [
  ["created", cmd("prompt")],
  ["created", started],
  ["starting", cmd("prompt")],
  ["idle", cmd("interrupt")],
  ["idle", approval],
  ["running", cmd("prompt")],
  ["running", started],
  ["awaiting_approval", cmd("prompt")],
  ["ended", cmd("prompt")],
  ["ended", delta],
  ["failed", cmd("close")],
];

describe("session state machine", () => {
  it.each(valid)("%s + %j -> %s", (from, input, to) => {
    expect(transition(from, input)).toBe(to);
  });

  it.each(invalid)("%s rejects %j", (from, input) => {
    expect(() => transition(from, input)).toThrow(InvalidTransitionError);
  });

  it("flags terminal states", () => {
    expect(isTerminal("ended")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("idle")).toBe(false);
  });
});
