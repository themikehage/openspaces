import { openEventStream, type StreamStatus } from "@openspaces/api-client";
import type { AgentEvent } from "@openspaces/core";
import type { SessionDto } from "@openspaces/protocol";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { client } from "@/lib/client";
import { initialTimeline, reduceTimeline } from "@/lib/timeline";

const REFRESH_ON = new Set([
  "turn.started",
  "turn.completed",
  "approval.requested",
  "approval.resolved",
  "session.error",
  "session.ended",
]);

export function useSession(sessionId: string) {
  const [timeline, push] = useReducer(reduceTimeline, initialTimeline);
  const [session, setSession] = useState<SessionDto | null>(null);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  const refreshSession = useCallback(async () => {
    try {
      const next = await client.getSession(sessionId);
      if (mounted.current) setSession(next);
    } catch (cause) {
      if (mounted.current) setActionError(cause instanceof Error ? cause.message : "Load failed");
    }
  }, [sessionId]);

  useEffect(() => {
    mounted.current = true;
    void refreshSession();
    const close = openEventStream({
      sessionId,
      onStatus: setStatus,
      onEvent: (event: AgentEvent) => {
        push(event);
        if (REFRESH_ON.has(event.type)) void refreshSession();
      },
    });
    return () => {
      mounted.current = false;
      close();
    };
  }, [sessionId, refreshSession]);

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    session,
    timeline,
    status,
    busy,
    actionError,
    sendPrompt: (text: string) => run(() => client.prompt(sessionId, text)),
    interrupt: () => run(() => client.interrupt(sessionId)),
    approve: (approvalId: string, decision: Parameters<typeof client.resolveApproval>[2]) =>
      run(() => client.resolveApproval(sessionId, approvalId, decision)),
    close: () => run(() => client.closeSession(sessionId)),
  };
}
