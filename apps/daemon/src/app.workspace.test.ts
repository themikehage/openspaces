import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeAgent } from "@openspaces/adapter-kit";
import {
  AdapterRegistry,
  MemorySessionStore,
  SessionService,
  withCapabilities,
  type Logger,
} from "@openspaces/core";
import { GitWorktreeProvider } from "@openspaces/workspace-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { ProjectGuard } from "./projects.js";

const TOKEN = "t".repeat(64);
const HOST = "127.0.0.1:3210";
const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };
const base = mkdtempSync(join(tmpdir(), "openspaces-ws-"));
const repo = join(base, "repo");
const plain = join(base, "plain");
let app: ReturnType<typeof createApp>;
let strict: ReturnType<typeof createApp>;

const git = (...args: string[]) =>
  execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    encoding: "utf8",
  });

function build(max: number | undefined, resume: boolean) {
  const registry = new AdapterRegistry();
  const fake = createFakeAgent();
  registry.register({ ...fake, capabilities: withCapabilities({ ...fake.capabilities, resume }) });
  const workspaces = new GitWorktreeProvider({ root: join(base, "worktrees"), logger: silent });
  let n = 0;
  return ProjectGuard.create([repo, plain]).then((projects) =>
    createApp({
      registry,
      workspaces,
      projects,
      service: new SessionService({
        registry,
        workspaces,
        store: new MemorySessionStore(),
        clock: { now: () => Date.now() },
        ids: { next: () => `s${max ?? 0}-${++n}` },
        logger: silent,
        ...(max !== undefined ? { maxLiveSessions: max } : {}),
      }),
      security: { token: TOKEN, allowedHosts: [HOST], allowedOrigins: [`http://${HOST}`] },
      logger: silent,
    }),
  );
}

beforeAll(async () => {
  mkdirSync(repo);
  mkdirSync(plain);
  execFileSync("git", ["init", "-q", "-b", "main", repo]);
  writeFileSync(join(repo, "a.txt"), "a");
  git("add", ".");
  git("commit", "-q", "-m", "init");
  app = await build(undefined, true);
  strict = await build(1, false);
});

afterAll(() => rmSync(base, { recursive: true, force: true }));

function call(target: ReturnType<typeof createApp>, path: string, method = "GET", body?: unknown) {
  return target.request(`http://${HOST}${path}`, {
    method,
    headers: { host: HOST, authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function until(check: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("condition not met");
}

describe("workspaces through the API", () => {
  it("uses a worktree for git projects and cleans it up when untouched", async () => {
    const res = await call(app, "/api/sessions", "POST", { adapterId: "fake", cwd: repo });
    const session = (await res.json()) as {
      id: string;
      cwd: string;
      workspace: string;
      projectPath: string;
    };
    expect(session.workspace).toBe("worktree");
    expect(session.cwd).not.toBe(repo);
    expect(session.cwd.startsWith(join(base, "worktrees"))).toBe(true);
    expect(existsSync(join(session.cwd, "a.txt"))).toBe(true);

    await call(app, `/api/sessions/${session.id}`, "DELETE");
    await until(() => !existsSync(session.cwd));
  });

  it("keeps a worktree that has uncommitted work", async () => {
    const res = await call(app, "/api/sessions", "POST", { adapterId: "fake", cwd: repo });
    const session = (await res.json()) as { id: string; cwd: string };
    writeFileSync(join(session.cwd, "work.txt"), "x");
    await call(app, `/api/sessions/${session.id}`, "DELETE");
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(existsSync(join(session.cwd, "work.txt"))).toBe(true);
  });

  it("runs in place for non-git projects and when asked", async () => {
    const plainRes = await call(app, "/api/sessions", "POST", { adapterId: "fake", cwd: plain });
    expect(((await plainRes.json()) as { workspace: string }).workspace).toBe("in-place");
    const forced = await call(app, "/api/sessions", "POST", {
      adapterId: "fake",
      cwd: repo,
      workspace: "in-place",
    });
    const body = (await forced.json()) as { workspace: string; cwd: string };
    expect(body).toMatchObject({ workspace: "in-place" });
    expect(body.cwd).toContain("repo");
  });

  it("reports a clear error for worktrees on non-git projects", async () => {
    const res = await call(app, "/api/sessions", "POST", {
      adapterId: "fake",
      cwd: plain,
      workspace: "worktree",
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "workspace_unavailable",
    );
  });

  it("limits concurrent sessions with 429", async () => {
    const first = await call(strict, "/api/sessions", "POST", { adapterId: "fake", cwd: plain });
    expect(first.status).toBe(201);
    const second = await call(strict, "/api/sessions", "POST", { adapterId: "fake", cwd: plain });
    expect(second.status).toBe(429);
  });

  it("resumes ended sessions and refuses when unsupported", async () => {
    const created = (await (
      await call(app, "/api/sessions", "POST", { adapterId: "fake", cwd: plain })
    ).json()) as { id: string };
    expect((await call(app, `/api/sessions/${created.id}/resume`, "POST")).status).toBe(409);
    await call(app, `/api/sessions/${created.id}`, "DELETE");
    await until(
      async () =>
        ((await (await call(app, `/api/sessions/${created.id}`)).json()) as { state: string })
          .state === "ended",
    );
    const resumed = await call(app, `/api/sessions/${created.id}/resume`, "POST");
    expect(resumed.status).toBe(201);
    expect(((await resumed.json()) as { id: string }).id).not.toBe(created.id);

    const other = (await (await call(strict, "/api/sessions", "GET")).json()) as {
      sessions: Array<{ id: string }>;
    };
    const id = other.sessions[0]?.id ?? "";
    await call(strict, `/api/sessions/${id}`, "DELETE");
    await until(
      async () =>
        ((await (await call(strict, `/api/sessions/${id}`)).json()) as { state: string }).state ===
        "ended",
    );
    const refused = await call(strict, `/api/sessions/${id}/resume`, "POST");
    expect(refused.status).toBe(409);
  });
});
