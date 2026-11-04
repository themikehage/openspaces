export const EVENT_SCHEMA_VERSION = 1 as const;

export type ApprovalDecision = "allow_once" | "allow_session" | "deny";

export type TurnStopReason = "completed" | "interrupted" | "error";

export type SessionEndReason = "completed" | "closed" | "failed";

export type ToolStatus = "ok" | "error";

export type MessageRole = "user" | "assistant";

export interface ApprovalOption {
  decision: ApprovalDecision;
  label: string;
}

export type AgentEventBody =
  | { type: "session.started"; externalSessionId?: string }
  | { type: "turn.started" }
  | { type: "turn.completed"; stopReason: TurnStopReason }
  | { type: "message.delta"; messageId: string; text: string }
  | { type: "message.completed"; messageId: string; role: MessageRole; text: string }
  | { type: "thinking.delta"; text: string }
  | { type: "tool.started"; toolCallId: string; name: string; input: unknown }
  | { type: "tool.output"; toolCallId: string; chunk: string }
  | { type: "tool.completed"; toolCallId: string; status: ToolStatus; output?: string }
  | {
      type: "approval.requested";
      approvalId: string;
      toolCallId?: string;
      title: string;
      details?: unknown;
      options: ApprovalOption[];
    }
  | { type: "approval.resolved"; approvalId: string; decision: ApprovalDecision }
  | { type: "usage.reported"; inputTokens?: number; outputTokens?: number; costUsd?: number }
  | { type: "session.error"; code: string; message: string; fatal: boolean }
  | { type: "session.ended"; reason: SessionEndReason };

export type AgentEventType = AgentEventBody["type"];

export type AgentEvent = AgentEventBody & {
  id: number;
  ts: number;
  sessionId: string;
  schemaVersion: typeof EVENT_SCHEMA_VERSION;
  raw?: unknown;
};
