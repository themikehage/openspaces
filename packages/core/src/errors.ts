export class OpenSpacesError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class InvalidTransitionError extends OpenSpacesError {
  constructor(from: string, input: string) {
    super("invalid_transition", `Cannot apply "${input}" while session is ${from}`);
  }
}

export class DuplicateAdapterError extends OpenSpacesError {
  constructor(id: string) {
    super("duplicate_adapter", `Adapter "${id}" is already registered`);
  }
}

export class UnknownAdapterError extends OpenSpacesError {
  constructor(id: string) {
    super("unknown_adapter", `No adapter registered with id "${id}"`);
  }
}

export class UnknownSessionError extends OpenSpacesError {
  constructor(id: string) {
    super("unknown_session", `No session with id "${id}"`);
  }
}

export class AdapterStartError extends OpenSpacesError {
  constructor(adapterId: string, reason: string) {
    super("adapter_start_failed", `Could not start "${adapterId}": ${reason}`);
  }
}

export class SessionLimitError extends OpenSpacesError {
  constructor(limit: number) {
    super("session_limit", `Too many active sessions (limit ${limit})`);
  }
}

export class WorkspaceUnavailableError extends OpenSpacesError {
  constructor(reason: string) {
    super("workspace_unavailable", reason);
  }
}

export class NotResumableError extends OpenSpacesError {
  constructor(id: string, reason: string) {
    super("not_resumable", `Session ${id} cannot be resumed: ${reason}`);
  }
}
