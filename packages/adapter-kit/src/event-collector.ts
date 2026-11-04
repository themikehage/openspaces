import type { AgentEventBody, AgentRun } from "@openspaces/core";

export class EventCollector {
  readonly events: AgentEventBody[] = [];
  private readonly listeners = new Set<() => void>();
  private finished = false;
  private readonly pump: Promise<void>;

  constructor(run: AgentRun) {
    this.pump = (async () => {
      for await (const event of run.events) {
        this.events.push(event);
        this.listeners.forEach((notify) => notify());
      }
      this.finished = true;
      this.listeners.forEach((notify) => notify());
    })();
  }

  get ended(): boolean {
    return this.finished;
  }

  waitFor(
    predicate: (events: readonly AgentEventBody[]) => boolean,
    timeoutMs = 2000,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(check);
        reject(
          new Error(
            `Timed out after ${timeoutMs}ms; saw: ${this.events.map((e) => e.type).join(", ")}`,
          ),
        );
      }, timeoutMs);
      const check = (): void => {
        if (!predicate(this.events) && !this.finished) return;
        clearTimeout(timer);
        this.listeners.delete(check);
        resolve();
      };
      this.listeners.add(check);
      check();
    });
  }

  waitForType(type: AgentEventBody["type"], fromIndex = 0, timeoutMs = 2000): Promise<void> {
    return this.waitFor(
      (events) => events.slice(fromIndex).some((e) => e.type === type),
      timeoutMs,
    );
  }

  async settled(): Promise<void> {
    await this.pump;
  }
}
