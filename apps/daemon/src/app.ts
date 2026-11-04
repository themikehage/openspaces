import {
  UnknownSessionError,
  type AdapterRegistry,
  type Logger,
  type SessionRecord,
  type SessionService,
} from "@openspaces/core";
import {
  adapterInfoSchema,
  approvalRequestSchema,
  createSessionRequestSchema,
  promptRequestSchema,
} from "@openspaces/protocol";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { handleError } from "./http-errors.js";
import type { ProjectGuard } from "./projects.js";
import {
  COOKIE_NAME,
  errorBody,
  hostAndOriginGuard,
  requireAuth,
  tokenMatches,
  type SecurityConfig,
} from "./security.js";
import { mountWeb } from "./static.js";
import { streamSession } from "./sse.js";

export interface DaemonDeps {
  service: SessionService;
  registry: AdapterRegistry;
  projects: ProjectGuard;
  security: SecurityConfig;
  logger: Logger;
  webRoot?: string;
}

async function json(c: { req: { json(): Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

export function createApp(deps: DaemonDeps): Hono {
  const { service, registry, projects, security } = deps;
  const app = new Hono();

  app.onError((error, c) => {
    if (!(error instanceof Error) || error.name === "TypeError") {
      deps.logger.error("unhandled error", { error: String(error) });
    }
    return handleError(error, c);
  });
  app.notFound((c) => c.json(errorBody("not_found", "Route not found"), 404));
  app.use("*", hostAndOriginGuard(security));

  app.get("/auth/exchange", (c) => {
    if (!tokenMatches(security.token, c.req.query("token"))) {
      return c.json(errorBody("unauthorized", "Invalid token"), 401);
    }
    setCookie(c, COOKIE_NAME, security.token, {
      httpOnly: true,
      sameSite: "Strict",
      path: "/",
    });
    return c.redirect("/", 302);
  });

  const api = new Hono();
  api.use("*", requireAuth(security));

  const mustGet = async (id: string): Promise<SessionRecord> => {
    const session = await service.get(id);
    if (!session) throw new UnknownSessionError(id);
    return session;
  };

  api.get("/health", (c) => c.json({ ok: true }));

  api.get("/projects", (c) => c.json({ projects: projects.list() }));

  api.get("/adapters", async (c) => {
    const infos = await Promise.all(
      registry.list().map(async (adapter) =>
        adapterInfoSchema.parse({
          id: adapter.id,
          displayName: adapter.displayName,
          capabilities: adapter.capabilities,
          probe: await adapter.probe(),
        }),
      ),
    );
    return c.json({ adapters: infos });
  });

  api.get("/sessions", async (c) => c.json({ sessions: await service.list() }));

  api.post("/sessions", async (c) => {
    const body = createSessionRequestSchema.parse(await json(c));
    const cwd = await projects.resolve(body.cwd);
    const session = await service.create({
      adapterId: body.adapterId,
      cwd,
      ...(body.resumeExternalSessionId
        ? { resumeExternalSessionId: body.resumeExternalSessionId }
        : {}),
      ...(body.options ? { options: body.options } : {}),
    });
    return c.json(session, 201);
  });

  api.get("/sessions/:id", async (c) => c.json(await mustGet(c.req.param("id"))));

  api.get("/sessions/:id/log", async (c) => {
    const id = c.req.param("id");
    await mustGet(id);
    const after = Number(c.req.query("after") ?? 0) || 0;
    return c.json({ events: await service.events(id, after) });
  });

  api.get("/sessions/:id/events", async (c) => {
    const id = c.req.param("id");
    await mustGet(id);
    const cursor = c.req.header("last-event-id") ?? c.req.query("after") ?? "0";
    return streamSession(c, service, id, Number(cursor) || 0);
  });

  api.post("/sessions/:id/prompt", async (c) => {
    const { text } = promptRequestSchema.parse(await json(c));
    await service.prompt(c.req.param("id"), text);
    return c.json({ accepted: true }, 202);
  });

  api.post("/sessions/:id/interrupt", async (c) => {
    await service.interrupt(c.req.param("id"));
    return c.json({ accepted: true }, 202);
  });

  api.post("/sessions/:id/approvals/:approvalId", async (c) => {
    const { decision } = approvalRequestSchema.parse(await json(c));
    await service.resolveApproval(c.req.param("id"), c.req.param("approvalId"), decision);
    return c.json({ accepted: true }, 202);
  });

  api.delete("/sessions/:id", async (c) => {
    await service.close(c.req.param("id"));
    return c.body(null, 204);
  });

  app.route("/api", api);
  if (deps.webRoot) mountWeb(app, deps.webRoot);
  return app;
}
