import type { AgentEventBody } from "./events.js";
import { InvalidTransitionError } from "./errors.js";

export type SessionState =
  "created" | "starting" | "running" | "awaiting_approval" | "idle" | "ended" | "failed";

export type SessionCommand = "start" | "prompt" | "interrupt" | "close";

export type SessionInput =
  { kind: "command"; command: SessionCommand } | { kind: "event"; event: AgentEventBody };

export const TERMINAL_STATES: readonly SessionState[] = ["ended", "failed"];

export function isTerminal(state: SessionState): boolean {
  return TERMINAL_STATES.includes(state);
}

function describe(input: SessionInput): string {
  return input.kind === "command" ? input.command : input.event.type;
}

function fatalOrEnd(input: SessionInput): SessionState | undefined {
  if (input.kind !== "event") return undefined;
  const { event } = input;
  if (event.type === "session.error" && event.fatal) return "failed";
  if (event.type === "session.ended") return event.reason === "failed" ? "failed" : "ended";
  return undefined;
}

function isPassive(input: SessionInput): boolean {
  if (input.kind !== "event") return false;
  switch (input.event.type) {
    case "message.delta":
    case "message.completed":
    case "thinking.delta":
    case "tool.started":
    case "tool.output":
    case "tool.completed":
    case "usage.reported":
    case "session.error":
      return true;
    default:
      return false;
  }
}

export function transition(state: SessionState, input: SessionInput): SessionState {
  const reject = (): never => {
    throw new InvalidTransitionError(state, describe(input));
  };

  if (isTerminal(state)) return reject();

  if (input.kind === "command" && input.command === "close") return "ended";

  const terminal = fatalOrEnd(input);
  if (terminal && state !== "created") return terminal;

  switch (state) {
    case "created":
      return input.kind === "command" && input.command === "start" ? "starting" : reject();
    case "starting":
      return input.kind === "event" && input.event.type === "session.started" ? "idle" : reject();
    case "idle":
      if (input.kind === "command" && input.command === "prompt") return "running";
      return isPassive(input) ? "idle" : reject();
    case "running":
      if (input.kind === "command") return input.command === "interrupt" ? "running" : reject();
      if (input.event.type === "turn.completed") return "idle";
      if (input.event.type === "approval.requested") return "awaiting_approval";
      if (input.event.type === "turn.started") return "running";
      return isPassive(input) ? "running" : reject();
    case "awaiting_approval":
      if (input.kind === "command") {
        return input.command === "interrupt" ? "awaiting_approval" : reject();
      }
      if (input.event.type === "approval.resolved") return "running";
      if (input.event.type === "turn.completed") return "idle";
      return isPassive(input) ? "awaiting_approval" : reject();
    default:
      return reject();
  }
}
