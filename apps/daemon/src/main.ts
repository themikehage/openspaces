import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { createClaudeCodeAdapter } from "@openspaces/adapter-claude-code";
import { createFakeAgent } from "@openspaces/adapter-kit";
import { AdapterRegistry, SessionService, type Logger } from "@openspaces/core";
import { SqliteSessionStore } from "@openspaces/store-sqlite";
import { randomUUID } from "node:crypto";
import { createApp } from "./app.js";
import { ProjectGuard } from "./projects.js";

function parseArgs(argv: string[]) {
  const projects: string[] = [];
  let port = Number(process.env["OPENSPACES_PORT"] ?? 3210);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--project" && argv[i + 1]) projects.push(argv[++i] as string);
    else if (arg === "--port" && argv[i + 1]) port = Number(argv[++i]);
  }
  return { projects, port };
}

const logger: Logger = {
  debug: () => undefined,
  info: (message, fields) => console.log(JSON.stringify({ level: "info", message, ...fields })),
  warn: (message, fields) => console.warn(JSON.stringify({ level: "warn", message, ...fields })),
  error: (message, fields) => console.error(JSON.stringify({ level: "error", message, ...fields })),
};

async function main() {
  const { projects, port } = parseArgs(process.argv.slice(2));
  if (projects.length === 0) {
    console.error("Usage: openspaces-daemon --project <dir> [--project <dir>] [--port 3210]");
    process.exit(2);
  }
  const dataDir =
    process.env["OPENSPACES_DATA_DIR"] ?? join(homedir(), ".local", "share", "openspaces");
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });

  const registry = new AdapterRegistry();
  registry.register(createClaudeCodeAdapter());
  if (process.env["OPENSPACES_FAKE"] === "1") registry.register(createFakeAgent());

  const service = new SessionService({
    registry,
    store: new SqliteSessionStore(join(dataDir, "openspaces.sqlite")),
    clock: { now: () => Date.now() },
    ids: { next: () => randomUUID() },
    logger,
  });

  const defaultWeb = resolve(import.meta.dirname, "../../web/dist");
  const webRoot =
    process.env["OPENSPACES_WEB_DIR"] ?? (existsSync(defaultWeb) ? defaultWeb : undefined);

  const token = randomBytes(32).toString("hex");
  const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  const app = createApp({
    service,
    registry,
    projects: await ProjectGuard.create(projects),
    security: { token, allowedHosts: hosts, allowedOrigins: hosts.map((h) => `http://${h}`) },
    logger,
    ...(webRoot ? { webRoot } : {}),
  });

  serve({ fetch: app.fetch, hostname: "127.0.0.1", port });
  console.log(`OpenSpaces listening on http://127.0.0.1:${port}`);
  console.log(`Open: http://127.0.0.1:${port}/auth/exchange?token=${token}`);
  console.log(`API token (Authorization: Bearer): ${token}`);
}

void main();
