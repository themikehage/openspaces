import type { AgentEvent } from "@openspaces/core";
import { SessionNotLiveError, type SessionService } from "@openspaces/core";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

const HEARTBEAT_MS = 15_000;
const PAGE = 500;

export function streamSession(c: Context, service: SessionService, id: string, after: number) {
  return streamSSE(c, async (stream) => {
    const queue: AgentEvent[] = [];
    let wake: (() => void) | undefined;
    let aborted = false;
    stream.onAbort(() => {
      aborted = true;
      wake?.();
    });

    let live = true;
    let unsubscribe: () => void = () => undefined;
    try {
      unsubscribe = service.subscribe(id, (event) => {
        queue.push(event);
        wake?.();
      });
    } catch (error) {
      if (!(error instanceof SessionNotLiveError)) throw error;
      live = false;
    }

    let sent = after;
    let finished = false;
    const emit = async (event: AgentEvent) => {
      if (event.id <= sent) return;
      sent = event.id;
      await stream.writeSSE({
        id: String(event.id),
        event: event.type,
        data: JSON.stringify(event),
      });
      if (event.type === "session.ended") finished = true;
    };

    try {
      for (;;) {
        const page = await service.events(id, sent, PAGE);
        for (const event of page) await emit(event);
        if (page.length < PAGE) break;
      }
      while (live && !finished && !aborted) {
        for (const event of queue.splice(0)) await emit(event);
        if (finished || aborted) break;
        if (queue.length > 0) continue;
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, HEARTBEAT_MS);
          wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        wake = undefined;
        if (queue.length === 0 && !aborted) await stream.write(": ping\n\n");
      }
    } finally {
      unsubscribe();
    }
  });
}
