import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { createClaudeCodeAdapter } from "@openspaces/adapter-claude-code";
import { createDevinAdapter } from "@openspaces/adapter-devin";
import { createFakeAgent } from "@openspaces/adapter-kit";
import { AdapterRegistry, SessionService } from "@openspaces/core";
import { SqliteSessionStore } from "@openspaces/store-sqlite";
import { GitWorktreeProvider } from "@openspaces/workspace-git";
import { createApp } from "./app.js";
import { createLogger } from "./logger.js";
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

async function main() {
  const logger = createLogger();
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
  registry.register(createDevinAdapter());
  if (process.env["OPENSPACES_FAKE"] === "1") registry.register(createFakeAgent());

  const store = new SqliteSessionStore(join(dataDir, "openspaces.sqlite"));
  const workspaces = new GitWorktreeProvider({ root: join(dataDir, "worktrees"), logger });
  const service = new SessionService({
    registry,
    store,
    workspaces,
    maxLiveSessions: Number(process.env["OPENSPACES_MAX_SESSIONS"] ?? 8),
    clock: { now: () => Date.now() },
    ids: { next: () => randomUUID() },
    logger,
  });
  const recovered = await service.recover();
  if (recovered > 0) logger.warn("marked interrupted sessions as failed", { count: recovered });

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
    workspaces,
    ...(webRoot ? { webRoot } : {}),
  });

  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port });

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info("shutting down", { signal });
    server.close();
    await service.closeAll();
    store.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  console.log(`OpenSpaces listening on http://127.0.0.1:${port}`);
  console.log(`Open: http://127.0.0.1:${port}/auth/exchange?token=${token}`);
  console.log(`API token (Authorization: Bearer): ${token}`);
}

void main();
