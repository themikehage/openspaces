import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeAgent, FAKE_TRIGGERS } from "@openspaces/adapter-kit";
import { AdapterRegistry, MemorySessionStore, SessionService, type Logger } from "@openspaces/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { ProjectGuard } from "./projects.js";

const TOKEN = "t".repeat(64);
const HOST = "127.0.0.1:3210";
const ORIGIN = `http://${HOST}`;
const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };

let web: string;
let root: string;
let outside: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "openspaces-daemon-"));
  outside = mkdtempSync(join(tmpdir(), "openspaces-outside-"));
  mkdirSync(join(root, "proj"));
  web = mkdtempSync(join(tmpdir(), "openspaces-web-"));
  mkdirSync(join(web, "assets"));
  writeFileSync(join(web, "index.html"), "<!doctype html><title>x</title>");
  writeFileSync(join(web, "assets", "a.js"), "console.log(1)");
  writeFileSync(join(tmpdir(), "openspaces-secret.txt"), "secret");
  const registry = new AdapterRegistry();
  registry.register(createFakeAgent());
  let n = 0;
  app = createApp({
    registry,
    service: new SessionService({
      registry,
      store: new MemorySessionStore(),
      clock: { now: () => Date.now() },
      ids: { next: () => `s${++n}` },
      logger: silent,
    }),
    projects: await ProjectGuard.create([root]),
    security: { token: TOKEN, allowedHosts: [HOST], allowedOrigins: [ORIGIN] },
    logger: silent,
    webRoot: web,
  });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
  rmSync(web, { recursive: true, force: true });
  rmSync(join(tmpdir(), "openspaces-secret.txt"), { force: true });
});

const auth = { host: HOST, authorization: `Bearer ${TOKEN}` };

function call(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  return app.request(`${ORIGIN}${path}`, {
    method: init.method ?? "GET",
    headers: { ...auth, "content-type": "application/json", ...init.headers },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
}

async function createSession(): Promise<string> {
  const res = await call("/api/sessions", {
    method: "POST",
    body: { adapterId: "fake", cwd: join(root, "proj") },
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function readSse(res: Response, until: (types: string[]) => boolean) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("no body");
  const decoder = new TextDecoder();
  const events: Array<{ id: string; event: string; data: Record<string, unknown> }> = [];
  let buffer = "";
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const fields = Object.fromEntries(
        frame
          .split("\n")
          .filter((line) => !line.startsWith(":") && line.includes(": "))
          .map((line) => [line.slice(0, line.indexOf(": ")), line.slice(line.indexOf(": ") + 2)]),
      );
      if (fields["data"]) {
        events.push({
          id: fields["id"] ?? "",
          event: fields["event"] ?? "",
          data: JSON.parse(fields["data"]),
        });
      }
    }
    if (until(events.map((e) => e.event))) break;
  }
  await reader.cancel();
  return events;
}

describe("security", () => {
  it("rejects unexpected Host headers", async () => {
    const res = await app.request(`${ORIGIN}/api/health`, {
      headers: { host: "evil.example:3210", authorization: `Bearer ${TOKEN}` },
    });
    expect(res.status).toBe(403);
  });

  it("rejects foreign Origins even with a valid token", async () => {
    const res = await call("/api/health", { headers: { origin: "http://evil.example" } });
    expect(res.status).toBe(403);
  });

  it("requires credentials", async () => {
    const missing = await app.request(`${ORIGIN}/api/health`, { headers: { host: HOST } });
    const wrong = await call("/api/health", { headers: { authorization: "Bearer nope" } });
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect((await call("/api/health")).status).toBe(200);
  });

  it("exchanges the token for a strict HttpOnly cookie", async () => {
    const bad = await app.request(`${ORIGIN}/auth/exchange?token=bad`, { headers: { host: HOST } });
    expect(bad.status).toBe(401);
    const ok = await app.request(`${ORIGIN}/auth/exchange?token=${TOKEN}`, {
      headers: { host: HOST },
    });
    expect(ok.status).toBe(302);
    const cookie = ok.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(ok.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("requires an Origin for unsafe cookie-authenticated requests", async () => {
    const headers = {
      host: HOST,
      cookie: `openspaces_token=${TOKEN}`,
      "content-type": "application/json",
    };
    const body = JSON.stringify({ adapterId: "fake", cwd: join(root, "proj") });
    const noOrigin = await app.request(`${ORIGIN}/api/sessions`, { method: "POST", headers, body });
    expect(noOrigin.status).toBe(403);
    const withOrigin = await app.request(`${ORIGIN}/api/sessions`, {
      method: "POST",
      headers: { ...headers, origin: ORIGIN },
      body,
    });
    expect(withOrigin.status).toBe(201);
  });
});

describe("sessions API", () => {
  it("lists adapters with probe results", async () => {
    const body = (await (await call("/api/adapters")).json()) as {
      adapters: Array<{ id: string }>;
    };
    expect(body.adapters.map((a) => a.id)).toEqual(["fake"]);
  });

  it("refuses directories outside registered projects", async () => {
    const res = await call("/api/sessions", {
      method: "POST",
      body: { adapterId: "fake", cwd: outside },
    });
    expect(res.status).toBe(403);
    const missing = await call("/api/sessions", {
      method: "POST",
      body: { adapterId: "fake", cwd: "/nope/x" },
    });
    expect(missing.status).toBe(403);
  });

  it("validates bodies and reports unknown ids", async () => {
    expect((await call("/api/sessions", { method: "POST", body: { adapterId: "" } })).status).toBe(
      400,
    );
    expect((await call("/api/sessions/nope")).status).toBe(404);
    expect(
      (
        await call("/api/sessions", {
          method: "POST",
          body: { adapterId: "zzz", cwd: join(root, "proj") },
        })
      ).status,
    ).toBe(404);
  });

  it("runs a full prompt, approval and close round trip", async () => {
    const id = await createSession();
    const stream = await call(`/api/sessions/${id}/events`);
    expect(stream.headers.get("content-type")).toContain("text/event-stream");

    const prompt = await call(`/api/sessions/${id}/prompt`, {
      method: "POST",
      body: { text: FAKE_TRIGGERS.approval },
    });
    expect(prompt.status).toBe(202);

    const first = await readSse(stream, (types) => types.includes("approval.requested"));
    const request = first.find((e) => e.event === "approval.requested");
    expect(request).toBeDefined();

    const approve = await call(`/api/sessions/${id}/approvals/${request?.data["approvalId"]}`, {
      method: "POST",
      body: { decision: "allow_once" },
    });
    expect(approve.status).toBe(202);

    const resumed = await call(`/api/sessions/${id}/events`, {
      headers: { "last-event-id": String(request?.id) },
    });
    const rest = await readSse(resumed, (types) => types.includes("turn.completed"));
    expect(rest.map((e) => e.event)).toContain("approval.resolved");
    expect(Number(rest[0]?.id)).toBeGreaterThan(Number(request?.id));

    const log = (await (await call(`/api/sessions/${id}/log`)).json()) as {
      events: Array<{ id: number }>;
    };
    expect(log.events.map((e) => e.id)).toEqual(log.events.map((_, i) => i + 1));

    expect((await call(`/api/sessions/${id}`, { method: "DELETE" })).status).toBe(204);
    const ended = (await (await call(`/api/sessions/${id}`)).json()) as { state: string };
    expect(ended.state).toBe("ended");
    expect(
      (await call(`/api/sessions/${id}/prompt`, { method: "POST", body: { text: "x" } })).status,
    ).toBe(409);
  });

  it("replays finished sessions and then closes the stream", async () => {
    const id = await createSession();
    await call(`/api/sessions/${id}`, { method: "DELETE" });
    const events = await readSse(await call(`/api/sessions/${id}/events`), () => false);
    expect(events.map((e) => e.event)).toEqual(["session.started", "session.ended"]);
  });

  it("interrupts a running turn", async () => {
    const id = await createSession();
    const stream = await call(`/api/sessions/${id}/events`);
    await call(`/api/sessions/${id}/prompt`, {
      method: "POST",
      body: { text: FAKE_TRIGGERS.slow },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await call(`/api/sessions/${id}/interrupt`, { method: "POST" })).status).toBe(202);
    const events = await readSse(stream, (types) => types.includes("turn.completed"));
    expect(events.find((e) => e.event === "turn.completed")?.data["stopReason"]).toBe(
      "interrupted",
    );
    await call(`/api/sessions/${id}`, { method: "DELETE" });
  });
});

describe("web hosting", () => {
  const page = (path: string) => app.request(`${ORIGIN}${path}`, { headers: { host: HOST } });

  it("serves the app shell without credentials, with a strict CSP", async () => {
    const res = await page("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(await res.text()).toContain("<title>x</title>");
  });

  it("serves hashed assets as immutable and falls back to the shell for routes", async () => {
    const asset = await page("/assets/a.js");
    expect(asset.headers.get("content-type")).toContain("javascript");
    expect(asset.headers.get("cache-control")).toContain("immutable");
    expect(await (await page("/some/client/route")).text()).toContain("<title>x</title>");
  });

  it("does not escape the web root", async () => {
    const res = await page("/..%2fopenspaces-secret.txt");
    expect(await res.text()).not.toContain("secret");
  });

  it("keeps unknown API routes as JSON 404 and protected", async () => {
    const res = await page("/api/nope");
    expect(res.status).toBe(401);
  });
});
