import type { AdapterCapabilities } from "./capabilities.js";
import type { AgentEvent, AgentEventBody, ApprovalDecision } from "./events.js";
import type { SessionState } from "./session-state.js";

export interface AgentStartSpec {
  cwd: string;
  resumeExternalSessionId?: string;
  env?: Readonly<Record<string, string>>;
  options?: Readonly<Record<string, unknown>>;
}

export interface UserInput {
  text: string;
}

export interface AgentRun {
  readonly events: AsyncIterable<AgentEventBody>;
  send(input: UserInput): Promise<void>;
  interrupt(): Promise<void>;
  resolveApproval(approvalId: string, decision: ApprovalDecision): Promise<void>;
  close(): Promise<void>;
}

export interface AdapterProbe {
  available: boolean;
  supported: boolean;
  version?: string;
  reason?: string;
}

export interface AgentAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: AdapterCapabilities;
  probe(): Promise<AdapterProbe>;
  start(spec: AgentStartSpec): Promise<AgentRun>;
}

export interface SessionRecord {
  id: string;
  adapterId: string;
  cwd: string;
  state: SessionState;
  externalSessionId?: string;
  createdAt: number;
  updatedAt: number;
}

export type SessionPatch = Partial<Pick<SessionRecord, "state" | "externalSessionId">>;

export interface SessionStore {
  create(record: SessionRecord): Promise<void>;
  get(id: string): Promise<SessionRecord | undefined>;
  list(): Promise<SessionRecord[]>;
  update(id: string, patch: SessionPatch, updatedAt: number): Promise<SessionRecord>;
  appendEvent(sessionId: string, event: AgentEventBody, ts: number): Promise<AgentEvent>;
  readEvents(sessionId: string, afterId?: number, limit?: number): Promise<AgentEvent[]>;
}

export type WorkspaceMode = "worktree" | "in-place";

export interface WorkspaceSpec {
  projectPath: string;
  sessionId: string;
  mode: WorkspaceMode;
}

export interface Workspace {
  readonly path: string;
  dispose(): Promise<void>;
}

export interface WorkspaceProvider {
  create(spec: WorkspaceSpec): Promise<Workspace>;
}

export interface Clock {
  now(): number;
}

export interface IdGenerator {
  next(): string;
}

export interface Logger {
  debug(message: string, fields?: Readonly<Record<string, unknown>>): void;
  info(message: string, fields?: Readonly<Record<string, unknown>>): void;
  warn(message: string, fields?: Readonly<Record<string, unknown>>): void;
  error(message: string, fields?: Readonly<Record<string, unknown>>): void;
}
