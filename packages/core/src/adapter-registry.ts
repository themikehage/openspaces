import { DuplicateAdapterError, UnknownAdapterError } from "./errors.js";
import type { AgentAdapter } from "./ports.js";

export class AdapterRegistry {
  private readonly adapters = new Map<string, AgentAdapter>();

  register(adapter: AgentAdapter): void {
    if (this.adapters.has(adapter.id)) throw new DuplicateAdapterError(adapter.id);
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): AgentAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new UnknownAdapterError(id);
    return adapter;
  }

  list(): AgentAdapter[] {
    return [...this.adapters.values()];
  }
}
