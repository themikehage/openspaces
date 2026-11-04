import type { LineProcess } from "@openspaces/adapter-kit";
import { asNumber, asRecord, asString, type Json } from "./guards.js";

export class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

export type RequestHandler = (params: Json) => Promise<unknown> | unknown;
export type NotificationHandler = (params: Json) => void;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export class JsonRpcConnection {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly requestHandlers = new Map<string, RequestHandler>();
  private readonly notificationHandlers = new Map<string, NotificationHandler>();

  constructor(private readonly process: LineProcess) {
    process.onLine((line) => void this.receive(line));
    process.onExit(() => this.rejectAll(new Error("agent process exited")));
  }

  onRequest(method: string, handler: RequestHandler): void {
    this.requestHandlers.set(method, handler);
  }

  onNotification(method: string, handler: NotificationHandler): void {
    this.notificationHandlers.set(method, handler);
  }

  request(method: string, params: Json): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.process.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  }

  notify(method: string, params: Json): void {
    this.process.write(JSON.stringify({ jsonrpc: "2.0", method, params }));
  }

  rejectAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  private async receive(line: string): Promise<void> {
    let message: Json | undefined;
    try {
      message = asRecord(JSON.parse(line));
    } catch {
      return;
    }
    if (!message) return;

    const method = asString(message["method"]);
    const id = message["id"];
    if (method !== undefined) {
      const params = asRecord(message["params"]) ?? {};
      if (id === undefined || id === null) {
        this.notificationHandlers.get(method)?.(params);
      } else {
        await this.answer(id, method, params);
      }
      return;
    }

    const numeric = asNumber(id);
    const pending = numeric === undefined ? undefined : this.pending.get(numeric);
    if (numeric === undefined || !pending) return;
    this.pending.delete(numeric);
    const error = asRecord(message["error"]);
    if (error) {
      pending.reject(
        new RpcError(
          asNumber(error["code"]) ?? -32000,
          asString(error["message"]) ?? "RPC error",
          error["data"],
        ),
      );
    } else {
      pending.resolve(message["result"]);
    }
  }

  private async answer(id: unknown, method: string, params: Json): Promise<void> {
    const handler = this.requestHandlers.get(method);
    if (!handler) {
      this.process.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        }),
      );
      return;
    }
    try {
      const result = await handler(params);
      this.process.write(JSON.stringify({ jsonrpc: "2.0", id, result: result ?? null }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.process.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32603, message } }));
    }
  }
}
