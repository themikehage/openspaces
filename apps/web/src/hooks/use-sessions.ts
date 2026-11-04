import type { AdapterInfoDto, SessionDto } from "@openspaces/protocol";
import { useCallback, useEffect, useState } from "react";
import { client } from "@/lib/client";

const POLL_MS = 3000;

export function useSessions() {
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [adapters, setAdapters] = useState<AdapterInfoDto[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSessions(await client.listSessions());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load sessions");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    void client
      .listAdapters(controller.signal)
      .then(setAdapters)
      .catch(() => undefined);
    void client
      .listProjects(controller.signal)
      .then(setProjects)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const create = useCallback(
    async (input: { adapterId: string; cwd: string }) => {
      const session = await client.createSession(input);
      await refresh();
      return session;
    },
    [refresh],
  );

  return { sessions, adapters, projects, error, create, refresh };
}
