import { spawn, type ChildProcess } from "node:child_process";

export interface LineProcessOptions {
  command: string;
  args: readonly string[];
  cwd: string;
  env?: Readonly<Record<string, string>>;
  maxLineBytes?: number;
  killGraceMs?: number;
}

export interface LineProcess {
  write(line: string): void;
  onLine(listener: (line: string) => void): void;
  onExit(listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
  stderrTail(): string;
  readonly exited: boolean;
  stop(): Promise<void>;
}

const STDERR_TAIL_BYTES = 4096;

export function spawnLineProcess(options: LineProcessOptions): LineProcess {
  const maxLine = options.maxLineBytes ?? 8 * 1024 * 1024;
  const grace = options.killGraceMs ?? 2000;
  const child: ChildProcess = spawn(options.command, [...options.args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const lineListeners: Array<(line: string) => void> = [];
  const exitListeners: Array<(code: number | null, signal: NodeJS.Signals | null) => void> = [];
  let exited = false;
  let tail = "";
  let buffer = "";

  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    buffer += chunk;
    let index = buffer.indexOf("\n");
    while (index >= 0) {
      const line = buffer.slice(0, index).replace(/\r$/, "");
      buffer = buffer.slice(index + 1);
      if (line) lineListeners.forEach((listener) => listener(line));
      index = buffer.indexOf("\n");
    }
    if (buffer.length > maxLine) {
      buffer = "";
      child.kill("SIGKILL");
    }
  });

  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    tail = (tail + chunk).slice(-STDERR_TAIL_BYTES);
  });

  child.stdin?.on("error", () => undefined);
  child.on("error", (error) => {
    tail = `${tail}${error.message}`.slice(-STDERR_TAIL_BYTES);
    if (!exited) {
      exited = true;
      exitListeners.forEach((listener) => listener(null, null));
    }
  });
  child.on("exit", (code, signal) => {
    if (exited) return;
    exited = true;
    exitListeners.forEach((listener) => listener(code, signal));
  });

  return {
    write: (line) => {
      if (!exited) child.stdin?.write(`${line}\n`);
    },
    onLine: (listener) => void lineListeners.push(listener),
    onExit: (listener) => void exitListeners.push(listener),
    stderrTail: () => tail,
    get exited() {
      return exited;
    },
    stop: () =>
      new Promise<void>((resolve) => {
        if (exited) return resolve();
        const timer = setTimeout(() => child.kill("SIGKILL"), grace);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
        child.stdin?.end();
        child.kill("SIGTERM");
      }),
  };
}
