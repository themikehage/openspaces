export class EventChannel<T> implements AsyncIterable<T> {
  private readonly queue: T[] = [];
  private waiter: ((result: IteratorResult<T>) => void) | undefined;
  private done = false;

  push(value: T): void {
    if (this.done) return;
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = undefined;
      resolve({ value, done: false });
      return;
    }
    this.queue.push(value);
  }

  end(): void {
    if (this.done) return;
    this.done = true;
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = undefined;
      resolve({ value: undefined, done: true });
    }
  }

  get ended(): boolean {
    return this.done;
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        const value = this.queue.shift();
        if (value !== undefined) return Promise.resolve({ value, done: false });
        if (this.done) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => {
          this.waiter = resolve;
        });
      },
    };
  }
}
