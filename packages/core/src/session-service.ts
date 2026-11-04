import type { AdapterRegistry } from "./adapter-registry.js";
import { AdapterStartError, OpenSpacesError } from "./errors.js";
import type { AgentEvent, AgentEventBody, ApprovalDecision } from "./events.js";
import type { AgentRun, Clock, IdGenerator, Logger, SessionRecord, SessionStore } from "./ports.js";
import { isTerminal, transition, type SessionInput, type SessionState } from "./session-state.js";

export interface SessionServiceDeps {
  registry: AdapterRegistry;
  store: SessionStore;
  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
}

export interface CreateSessionInput {
  adapterId: string;
  cwd: string;
  resumeExternalSessionId?: string;
  options?: Readonly<Record<string, unknown>>;
}

type Listener = (event: AgentEvent) => void;

interface LiveSession {
  run: AgentRun;
  state: SessionState;
  listeners: Set<Listener>;
  queue: Promise<void>;
  ready: Promise<void>;
  closing: boolean;
  markReady: () => void;
}

export class SessionNotLiveError extends OpenSpacesError {
  constructor(id: string) {
    super("session_not_live", `Session ${id} has no active run`);
  }
}

export class SessionService {
  private readonly live = new Map<string, LiveSession>();

  constructor(private readonly deps: SessionServiceDeps) {}

  async create(input: CreateSessionInput): Promise<SessionRecord> {
    const { registry, store, clock, ids } = this.deps;
    const adapter = registry.get(input.adapterId);
    const probe = await adapter.probe();
    if (!probe.available || !probe.supported) {
      throw new AdapterStartError(adapter.id, probe.reason ?? "adapter is not available");
    }
    const now = clock.now();
    const record: SessionRecord = {
      id: ids.next(),
      adapterId: adapter.id,
      cwd: input.cwd,
      state: "created",
      createdAt: now,
      updatedAt: now,
    };
    await store.create(record);

    const run = await adapter.start({
      cwd: input.cwd,
      ...(input.resumeExternalSessionId
        ? { resumeExternalSessionId: input.resumeExternalSessionId }
        : {}),
      ...(input.options ? { options: input.options } : {}),
    });

    let markReady: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => {
      markReady = resolve;
    });
    const session: LiveSession = {
      run,
      state: "created",
      listeners: new Set(),
      queue: Promise.resolve(),
      ready,
      closing: false,
      markReady,
    };
    this.live.set(record.id, session);
    await this.apply(record.id, session, { kind: "command", command: "start" });
    void this.pump(record.id, session);
    await ready;
    return this.mustGet(record.id);
  }

  async get(id: string): Promise<SessionRecord | undefined> {
    return this.deps.store.get(id);
  }

  list(): Promise<SessionRecord[]> {
    return this.deps.store.list();
  }

  events(id: string, afterId?: number, limit?: number): Promise<AgentEvent[]> {
    return this.deps.store.readEvents(id, afterId, limit);
  }

  subscribe(id: string, listener: Listener): () => void {
    const session = this.liveSession(id);
    session.listeners.add(listener);
    return () => session.listeners.delete(listener);
  }

  async prompt(id: string, text: string): Promise<void> {
    const session = this.liveSession(id);
    const previous = session.state;
    await this.apply(id, session, { kind: "command", command: "prompt" });
    try {
      await this.record(id, session, {
        type: "message.completed",
        messageId: this.deps.ids.next(),
        role: "user",
        text,
      });
      await session.run.send({ text });
    } catch (error) {
      await this.setState(id, session, previous);
      throw error;
    }
  }

  async interrupt(id: string): Promise<void> {
    const session = this.liveSession(id);
    await this.apply(id, session, { kind: "command", command: "interrupt" });
    await session.run.interrupt();
  }

  async resolveApproval(id: string, approvalId: string, decision: ApprovalDecision): Promise<void> {
    await this.liveSession(id).run.resolveApproval(approvalId, decision);
  }

  async close(id: string): Promise<void> {
    const session = this.live.get(id);
    if (!session) return;
    session.closing = true;
    await session.run.close();
    await session.queue;
    this.live.delete(id);
  }

  private liveSession(id: string): LiveSession {
    const session = this.live.get(id);
    if (!session || isTerminal(session.state)) throw new SessionNotLiveError(id);
    return session;
  }

  private async mustGet(id: string): Promise<SessionRecord> {
    const record = await this.deps.store.get(id);
    if (!record) throw new Error(`Session ${id} vanished`);
    return record;
  }

  private async apply(id: string, session: LiveSession, input: SessionInput): Promise<void> {
    await this.setState(id, session, transition(session.state, input));
  }

  private async setState(id: string, session: LiveSession, next: SessionState): Promise<void> {
    if (next === session.state) return;
    session.state = next;
    await this.deps.store.update(id, { state: next }, this.deps.clock.now());
    if (next !== "starting" && next !== "created") session.markReady();
  }

  private async pump(id: string, session: LiveSession): Promise<void> {
    try {
      for await (const body of session.run.events) {
        session.queue = session.queue.then(() => this.handle(id, session, body));
        await session.queue;
      }
    } catch (error) {
      this.deps.logger.error("adapter stream failed", { id, error: String(error) });
      await this.fail(id, session, "adapter_stream_failed", String(error));
    } finally {
      session.markReady();
      if (!isTerminal(session.state) && session.closing) {
        await this.setState(id, session, "ended");
      } else if (!isTerminal(session.state)) {
        await this.fail(id, session, "stream_ended", "Adapter stream ended unexpectedly");
      }
    }
  }

  private async handle(id: string, session: LiveSession, body: AgentEventBody): Promise<void> {
    if (isTerminal(session.state)) return;
    try {
      const next = transition(session.state, { kind: "event", event: body });
      await this.record(id, session, body);
      if (body.type === "session.started" && body.externalSessionId) {
        await this.deps.store.update(
          id,
          { externalSessionId: body.externalSessionId },
          this.deps.clock.now(),
        );
      }
      await this.setState(id, session, next);
    } catch (error) {
      this.deps.logger.warn("rejected adapter event", {
        id,
        type: body.type,
        error: String(error),
      });
      await this.fail(id, session, "protocol_violation", String(error));
      await session.run.close().catch(() => undefined);
    }
  }

  private async record(id: string, session: LiveSession, body: AgentEventBody): Promise<void> {
    const stamped = await this.deps.store.appendEvent(id, body, this.deps.clock.now());
    session.listeners.forEach((listener) => listener(stamped));
  }

  private async fail(
    id: string,
    session: LiveSession,
    code: string,
    message: string,
  ): Promise<void> {
    if (isTerminal(session.state)) return;
    await this.record(id, session, { type: "session.error", code, message, fatal: true });
    await this.setState(id, session, "failed");
  }
}
