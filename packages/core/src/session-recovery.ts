import type { AgentEventBody } from "./events.js";
import type { Clock, SessionStore } from "./ports.js";
import { isTerminal } from "./session-state.js";

export async function recoverInterruptedSessions(
  store: SessionStore,
  clock: Clock,
  isLive: (id: string) => boolean,
): Promise<number> {
  let recovered = 0;
  for (const record of await store.list()) {
    if (isTerminal(record.state) || isLive(record.id)) continue;
    const failure: AgentEventBody = {
      type: "session.error",
      code: "daemon_restarted",
      message: "The daemon restarted while this session was active",
      fatal: true,
    };
    await store.appendEvent(record.id, failure, clock.now());
    await store.appendEvent(record.id, { type: "session.ended", reason: "failed" }, clock.now());
    await store.update(record.id, { state: "failed" }, clock.now());
    recovered += 1;
  }
  return recovered;
}
