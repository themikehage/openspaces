import type { Logger } from "@openspaces/core";

const SENSITIVE = /token|authorization|cookie|secret|password|api[-_]?key/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        SENSITIVE.test(key) ? "[redacted]" : redact(inner, depth + 1),
      ]),
    );
  }
  return value;
}

type Sink = (line: string) => void;

export function createLogger(sink: Sink = (line) => process.stderr.write(`${line}\n`)): Logger {
  const write = (level: string, message: string, fields?: Readonly<Record<string, unknown>>) =>
    sink(
      JSON.stringify({
        level,
        time: new Date().toISOString(),
        message,
        ...(redact(fields) as object),
      }),
    );
  return {
    debug: () => undefined,
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields),
  };
}
