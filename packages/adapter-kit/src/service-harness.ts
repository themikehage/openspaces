import {
  AdapterRegistry,
  MemorySessionStore,
  SessionService,
  type AgentAdapter,
  type Logger,
  type WorkspaceProvider,
} from "@openspaces/core";
import { createFakeAgent } from "./fake-agent.js";

const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };

export function build(
  adapter: AgentAdapter = createFakeAgent(),
  extra: { workspaces?: WorkspaceProvider; maxLiveSessions?: number } = {},
) {
  let n = 0;
  const registry = new AdapterRegistry();
  registry.register(adapter);
  const store = new MemorySessionStore();
  const service = new SessionService({
    registry,
    store,
    clock: { now: () => ++n },
    ids: { next: () => `s${++n}` },
    logger: silent,
    ...extra,
  });
  return { service, store };
}

export async function until(check: () => Promise<boolean> | boolean, ms = 2000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("condition not met");
}
