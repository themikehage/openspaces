import {
  AdapterStartError,
  NotResumableError,
  SessionLimitError,
  UnknownSessionError,
  WorkspaceUnavailableError,
} from "./errors.js";
import type { AgentEvent, AgentEventBody, ApprovalDecision } from "./events.js";
import type { AgentRun, SessionRecord, Workspace, WorkspaceMode } from "./ports.js";
import type {
  CreateSessionInput,
  LiveSession,
  SessionServiceDeps,
  Listener,
} from "./session-service-types.js";
import { SessionNotLiveError } from "./session-service-types.js";
import { recoverInterruptedSessions } from "./session-recovery.js";
import { isTerminal, transition, type SessionInput, type SessionState } from "./session-state.js";

export class SessionService {
  private readonly live = new Map<string, LiveSession>();

  constructor(private readonly deps: SessionServiceDeps) {}

  async create(input: CreateSessionInput): Promise<SessionRecord> {
    const { registry, store, clock, ids } = this.deps;
    const adapter = registry.get(input.adapterId);
    this.assertCapacity();
    const probe = await adapter.probe();
    if (!probe.available || !probe.supported) {
      throw new AdapterStartError(adapter.id, probe.reason ?? "adapter is not available");
    }

    const id = ids.next();
    const mode = input.workspaceMode ?? "in-place";
    const workspace = await this.openWorkspace(id, input.cwd, mode);
    const cwd = workspace?.path ?? input.cwd;
    const now = clock.now();
    const record: SessionRecord = {
      id,
      adapterId: adapter.id,
      cwd,
      projectPath: input.projectPath ?? input.cwd,
      workspace: mode,
      state: "created",
      createdAt: now,
      updatedAt: now,
    };
    await store.create(record);

    let run: AgentRun;
    try {
      run = await adapter.start({
        cwd,
        ...(input.resumeExternalSessionId
          ? { resumeExternalSessionId: input.resumeExternalSessionId }
          : {}),
        ...(input.options ? { options: input.options } : {}),
      });
    } catch (error) {
      await this.recordStartFailure(record, error);
      await workspace?.dispose().catch(() => undefined);
      throw error;
    }

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
      workspace,
      finished: Promise.resolve(),
      markReady,
    };
    this.live.set(record.id, session);
    await this.apply(record.id, session, { kind: "command", command: "start" });
    session.finished = this.pump(record.id, session);
    await ready;
    return this.mustGet(record.id);
  }

  async resume(id: string): Promise<SessionRecord> {
    const record = await this.deps.store.get(id);
    if (!record) throw new UnknownSessionError(id);
    if (!isTerminal(record.state)) throw new NotResumableError(id, "it is still active");
    if (!record.externalSessionId)
      throw new NotResumableError(id, "the agent session id is unknown");
    if (!this.deps.registry.get(record.adapterId).capabilities.resume) {
      throw new NotResumableError(id, "the agent does not support resuming");
    }
    return this.create({
      adapterId: record.adapterId,
      cwd: record.cwd,
      ...(record.projectPath ? { projectPath: record.projectPath } : {}),
      resumeExternalSessionId: record.externalSessionId,
    });
  }

  recover(): Promise<number> {
    return recoverInterruptedSessions(this.deps.store, this.deps.clock, (id) => this.live.has(id));
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.live.keys()].map((id) => this.close(id)));
  }

  liveCount(): number {
    return [...this.live.values()].filter((session) => !isTerminal(session.state)).length;
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
    await session.finished;
    this.live.delete(id);
  }

  private assertCapacity(): void {
    const limit = this.deps.maxLiveSessions;
    if (limit !== undefined && this.liveCount() >= limit) throw new SessionLimitError(limit);
  }

  private async openWorkspace(
    id: string,
    cwd: string,
    mode: WorkspaceMode,
  ): Promise<Workspace | undefined> {
    if (mode === "in-place") return undefined;
    const provider = this.deps.workspaces;
    if (!provider) throw new WorkspaceUnavailableError("Worktree sessions are not configured");
    return provider.create({ projectPath: cwd, sessionId: id, mode });
  }

  private async recordStartFailure(record: SessionRecord, error: unknown): Promise<void> {
    const { store, clock } = this.deps;
    const message = error instanceof Error ? error.message : String(error);
    await store.appendEvent(
      record.id,
      { type: "session.error", code: "start_failed", message, fatal: true },
      clock.now(),
    );
    await store.update(record.id, { state: "failed" }, clock.now());
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
      await this.release(id, session);
    }
  }

  private async release(id: string, session: LiveSession): Promise<void> {
    try {
      await session.workspace?.dispose();
    } catch (error) {
      this.deps.logger.warn("workspace cleanup failed", { id, error: String(error) });
    }
    this.live.delete(id);
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

export { SessionNotLiveError } from "./session-service-types.js";
export type { CreateSessionInput, SessionServiceDeps } from "./session-service-types.js";
