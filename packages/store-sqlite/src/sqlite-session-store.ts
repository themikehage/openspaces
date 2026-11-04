import { DatabaseSync } from "node:sqlite";
import {
  EVENT_SCHEMA_VERSION,
  type AgentEvent,
  type AgentEventBody,
  type SessionPatch,
  type SessionRecord,
  type SessionState,
  type SessionStore,
  type WorkspaceMode,
} from "@openspaces/core";

interface SessionRow {
  id: string;
  adapter_id: string;
  cwd: string;
  state: string;
  external_session_id: string | null;
  project_path: string | null;
  workspace: string | null;
  created_at: number;
  updated_at: number;
}

interface EventRow {
  id: number;
  ts: number;
  payload: string;
}

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    adapter_id TEXT NOT NULL,
    cwd TEXT NOT NULL,
    state TEXT NOT NULL,
    external_session_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    id INTEGER NOT NULL,
    ts INTEGER NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (session_id, id)
  );
`;

function toRecord(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    adapterId: row.adapter_id,
    cwd: row.cwd,
    state: row.state as SessionState,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.external_session_id ? { externalSessionId: row.external_session_id } : {}),
    ...(row.project_path ? { projectPath: row.project_path } : {}),
    ...(row.workspace ? { workspace: row.workspace as WorkspaceMode } : {}),
  };
}

export class SqliteSessionStore implements SessionStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(SCHEMA);
    this.migrate();
  }

  private migrate(): void {
    const row = this.db.prepare("PRAGMA user_version").get() as { user_version: number };
    if (row.user_version < 1) {
      this.db.exec("ALTER TABLE sessions ADD COLUMN project_path TEXT");
      this.db.exec("ALTER TABLE sessions ADD COLUMN workspace TEXT");
      this.db.exec("PRAGMA user_version = 1");
    }
  }

  close(): void {
    this.db.close();
  }

  async create(record: SessionRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO sessions
           (id, adapter_id, cwd, state, external_session_id, project_path, workspace, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.adapterId,
        record.cwd,
        record.state,
        record.externalSessionId ?? null,
        record.projectPath ?? null,
        record.workspace ?? null,
        record.createdAt,
        record.updatedAt,
      );
  }

  async get(id: string): Promise<SessionRecord | undefined> {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
      SessionRow | undefined;
    return row ? toRecord(row) : undefined;
  }

  async list(): Promise<SessionRecord[]> {
    const rows = this.db
      .prepare("SELECT * FROM sessions ORDER BY created_at DESC, id")
      .all() as unknown as SessionRow[];
    return rows.map(toRecord);
  }

  async update(id: string, patch: SessionPatch, updatedAt: number): Promise<SessionRecord> {
    const current = await this.get(id);
    if (!current) throw new Error(`Unknown session ${id}`);
    const next = { ...current, ...patch };
    this.db
      .prepare(
        "UPDATE sessions SET state = ?, external_session_id = ?, updated_at = ? WHERE id = ?",
      )
      .run(next.state, next.externalSessionId ?? null, updatedAt, id);
    return { ...next, updatedAt };
  }

  async appendEvent(sessionId: string, event: AgentEventBody, ts: number): Promise<AgentEvent> {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db
        .prepare("SELECT COALESCE(MAX(id), 0) + 1 AS next FROM events WHERE session_id = ?")
        .get(sessionId) as { next: number };
      this.db
        .prepare("INSERT INTO events (session_id, id, ts, payload) VALUES (?, ?, ?, ?)")
        .run(sessionId, row.next, ts, JSON.stringify(event));
      this.db.exec("COMMIT");
      return {
        ...event,
        id: row.next,
        ts,
        sessionId,
        schemaVersion: EVENT_SCHEMA_VERSION,
      };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async readEvents(sessionId: string, afterId = 0, limit = 1000): Promise<AgentEvent[]> {
    const rows = this.db
      .prepare(
        "SELECT id, ts, payload FROM events WHERE session_id = ? AND id > ? ORDER BY id LIMIT ?",
      )
      .all(sessionId, afterId, limit) as unknown as EventRow[];
    return rows.map((row) => ({
      ...(JSON.parse(row.payload) as AgentEventBody),
      id: row.id,
      ts: row.ts,
      sessionId,
      schemaVersion: EVENT_SCHEMA_VERSION,
    }));
  }
}
