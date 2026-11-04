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
