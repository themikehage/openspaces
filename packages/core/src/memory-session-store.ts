import { EVENT_SCHEMA_VERSION, type AgentEvent, type AgentEventBody } from "./events.js";
import type { SessionPatch, SessionRecord, SessionStore } from "./ports.js";

export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly events = new Map<string, AgentEvent[]>();

  async create(record: SessionRecord): Promise<void> {
    if (this.sessions.has(record.id)) throw new Error(`Session ${record.id} already exists`);
    this.sessions.set(record.id, { ...record });
    this.events.set(record.id, []);
  }

  async get(id: string): Promise<SessionRecord | undefined> {
    const record = this.sessions.get(id);
    return record ? { ...record } : undefined;
  }

  async list(): Promise<SessionRecord[]> {
    return [...this.sessions.values()]
      .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
      .map((record) => ({ ...record }));
  }

  async update(id: string, patch: SessionPatch, updatedAt: number): Promise<SessionRecord> {
    const current = this.sessions.get(id);
    if (!current) throw new Error(`Unknown session ${id}`);
    const next: SessionRecord = { ...current, ...patch, updatedAt };
    this.sessions.set(id, next);
    return { ...next };
  }

  async appendEvent(sessionId: string, event: AgentEventBody, ts: number): Promise<AgentEvent> {
    const log = this.events.get(sessionId);
    if (!log) throw new Error(`Unknown session ${sessionId}`);
    const stamped: AgentEvent = {
      ...event,
      id: log.length + 1,
      ts,
      sessionId,
      schemaVersion: EVENT_SCHEMA_VERSION,
    };
    log.push(stamped);
    return stamped;
  }

  async readEvents(sessionId: string, afterId = 0, limit = 1000): Promise<AgentEvent[]> {
    const log = this.events.get(sessionId) ?? [];
    return log.filter((event) => event.id > afterId).slice(0, limit);
  }
}
