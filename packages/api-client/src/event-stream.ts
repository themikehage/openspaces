import type { AgentEvent, AgentEventType } from "@openspaces/core";
import { agentEventSchema } from "@openspaces/protocol";

export type StreamStatus = "connecting" | "live" | "reconnecting" | "closed";

export interface EventStreamOptions {
  baseUrl?: string;
  sessionId: string;
  after?: number;
  onEvent: (event: AgentEvent) => void;
  onStatus: (status: StreamStatus) => void;
}

const EVENT_TYPES: readonly AgentEventType[] = [
  "session.started",
  "turn.started",
  "turn.completed",
  "message.delta",
  "message.completed",
  "thinking.delta",
  "tool.started",
  "tool.output",
  "tool.completed",
  "approval.requested",
  "approval.resolved",
  "usage.reported",
  "session.error",
  "session.ended",
];

export function openEventStream(options: EventStreamOptions): () => void {
  const url = `${options.baseUrl ?? ""}/api/sessions/${encodeURIComponent(options.sessionId)}/events?after=${options.after ?? 0}`;
  const source = new EventSource(url, { withCredentials: true });
  options.onStatus("connecting");

  source.onopen = () => options.onStatus("live");
  source.onerror = () => {
    options.onStatus(source.readyState === EventSource.CLOSED ? "closed" : "reconnecting");
  };

  const handle = (message: MessageEvent<string>) => {
    const parsed = agentEventSchema.safeParse(JSON.parse(message.data));
    if (parsed.success) options.onEvent(parsed.data as AgentEvent);
    if (parsed.success && parsed.data.type === "session.ended") {
      source.close();
      options.onStatus("closed");
    }
  };
  for (const type of EVENT_TYPES) source.addEventListener(type, handle as EventListener);

  return () => {
    source.close();
    options.onStatus("closed");
  };
}
