import type { AdapterRegistry } from "./adapter-registry.js";
import { OpenSpacesError } from "./errors.js";
import type { AgentEvent } from "./events.js";
import type {
  AgentRun,
  Clock,
  IdGenerator,
  Logger,
  SessionStore,
  Workspace,
  WorkspaceMode,
  WorkspaceProvider,
} from "./ports.js";
import type { SessionState } from "./session-state.js";

export interface SessionServiceDeps {
  registry: AdapterRegistry;
  store: SessionStore;
  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
  workspaces?: WorkspaceProvider;
  maxLiveSessions?: number;
}

export interface CreateSessionInput {
  adapterId: string;
  cwd: string;
  projectPath?: string;
  workspaceMode?: WorkspaceMode;
  resumeExternalSessionId?: string;
  options?: Readonly<Record<string, unknown>>;
}

export type Listener = (event: AgentEvent) => void;

export interface LiveSession {
  run: AgentRun;
  state: SessionState;
  listeners: Set<Listener>;
  queue: Promise<void>;
  ready: Promise<void>;
  closing: boolean;
  workspace: Workspace | undefined;
  finished: Promise<void>;
  markReady: () => void;
}

export class SessionNotLiveError extends OpenSpacesError {
  constructor(id: string) {
    super("session_not_live", `Session ${id} has no active run`);
  }
}
