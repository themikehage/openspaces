import type { AgentEvent, ApprovalDecision, ApprovalOption } from "@openspaces/core";

export type TimelineItem =
  | { kind: "message"; id: string; role: "user" | "assistant"; text: string; complete: boolean }
  | { kind: "thinking"; id: string; text: string }
  | {
      kind: "tool";
      id: string;
      name: string;
      input: unknown;
      output: string;
      status: "running" | "ok" | "error";
    }
  | {
      kind: "approval";
      id: string;
      title: string;
      details: unknown;
      options: ApprovalOption[];
      decision?: ApprovalDecision;
    }
  | { kind: "notice"; id: string; tone: "info" | "error"; text: string };

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface TimelineState {
  items: TimelineItem[];
  usage: Usage;
  lastEventId: number;
}

export const initialTimeline: TimelineState = {
  items: [],
  usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
  lastEventId: 0,
};

function replaceAt(items: TimelineItem[], index: number, item: TimelineItem): TimelineItem[] {
  return items.map((existing, i) => (i === index ? item : existing));
}

function findIndex(items: TimelineItem[], kind: TimelineItem["kind"], id: string): number {
  return items.findIndex((item) => item.kind === kind && item.id === id);
}

function appendAssistant(items: TimelineItem[], id: string, text: string): TimelineItem[] {
  const index = findIndex(items, "message", id);
  const current = items[index];
  if (current?.kind === "message") {
    return replaceAt(items, index, { ...current, text: current.text + text });
  }
  return [...items, { kind: "message", id, role: "assistant", text, complete: false }];
}

function completeMessage(
  items: TimelineItem[],
  id: string,
  role: "user" | "assistant",
  text: string,
): TimelineItem[] {
  const index = findIndex(items, "message", id);
  const item: TimelineItem = { kind: "message", id, role, text, complete: true };
  return index >= 0 ? replaceAt(items, index, item) : [...items, item];
}

function appendThinking(items: TimelineItem[], eventId: number, text: string): TimelineItem[] {
  const last = items.at(-1);
  if (last?.kind === "thinking") {
    return replaceAt(items, items.length - 1, { ...last, text: last.text + text });
  }
  return [...items, { kind: "thinking", id: `thinking-${eventId}`, text }];
}

function updateTool(
  items: TimelineItem[],
  id: string,
  update: (tool: Extract<TimelineItem, { kind: "tool" }>) => TimelineItem,
): TimelineItem[] {
  const index = findIndex(items, "tool", id);
  const current = items[index];
  return current?.kind === "tool" ? replaceAt(items, index, update(current)) : items;
}

function applyEvent(items: TimelineItem[], event: AgentEvent): TimelineItem[] {
  switch (event.type) {
    case "message.delta":
      return appendAssistant(items, event.messageId, event.text);
    case "message.completed":
      return completeMessage(items, event.messageId, event.role, event.text);
    case "thinking.delta":
      return appendThinking(items, event.id, event.text);
    case "tool.started":
      return [
        ...items,
        {
          kind: "tool",
          id: event.toolCallId,
          name: event.name,
          input: event.input,
          output: "",
          status: "running",
        },
      ];
    case "tool.output":
      return updateTool(items, event.toolCallId, (tool) => ({
        ...tool,
        output: tool.output + event.chunk,
      }));
    case "tool.completed":
      return updateTool(items, event.toolCallId, (tool) => ({
        ...tool,
        status: event.status,
        output: tool.output || event.output || "",
      }));
    case "approval.requested":
      return [
        ...items,
        {
          kind: "approval",
          id: event.approvalId,
          title: event.title,
          details: event.details,
          options: event.options,
        },
      ];
    case "approval.resolved": {
      const index = findIndex(items, "approval", event.approvalId);
      const current = items[index];
      return current?.kind === "approval"
        ? replaceAt(items, index, { ...current, decision: event.decision })
        : items;
    }
    case "session.error":
      return [
        ...items,
        { kind: "notice", id: `error-${event.id}`, tone: "error", text: event.message },
      ];
    case "turn.completed":
      return event.stopReason === "interrupted"
        ? [...items, { kind: "notice", id: `turn-${event.id}`, tone: "info", text: "Interrupted" }]
        : items;
    case "session.ended":
      return [
        ...items,
        { kind: "notice", id: `ended-${event.id}`, tone: "info", text: `Session ${event.reason}` },
      ];
    default:
      return items;
  }
}

export function reduceTimeline(state: TimelineState, event: AgentEvent): TimelineState {
  if (event.id <= state.lastEventId) return state;
  const usage =
    event.type === "usage.reported"
      ? {
          inputTokens: state.usage.inputTokens + (event.inputTokens ?? 0),
          outputTokens: state.usage.outputTokens + (event.outputTokens ?? 0),
          costUsd: state.usage.costUsd + (event.costUsd ?? 0),
        }
      : state.usage;
  return { items: applyEvent(state.items, event), usage, lastEventId: event.id };
}

export function pendingApprovals(items: readonly TimelineItem[]): number {
  return items.filter((item) => item.kind === "approval" && !item.decision).length;
}
