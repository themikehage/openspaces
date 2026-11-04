import { createHash, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";

export const COOKIE_NAME = "openspaces_token";

export interface SecurityConfig {
  token: string;
  allowedHosts: readonly string[];
  allowedOrigins: readonly string[];
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function tokenMatches(expected: string, received: string | undefined): boolean {
  if (!received) return false;
  return timingSafeEqual(digest(expected), digest(received));
}

export function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

function bearer(c: Context): string | undefined {
  const header = c.req.header("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

export function hostAndOriginGuard(config: SecurityConfig): MiddlewareHandler {
  return async (c, next) => {
    const host = c.req.header("host");
    if (!host || !config.allowedHosts.includes(host.toLowerCase())) {
      return c.json(errorBody("forbidden_host", "Host header not allowed"), 403);
    }
    const origin = c.req.header("origin");
    if (origin && !config.allowedOrigins.includes(origin.toLowerCase())) {
      return c.json(errorBody("forbidden_origin", "Origin not allowed"), 403);
    }
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Cache-Control", "no-store");
    return next();
  };
}

export function requireAuth(config: SecurityConfig): MiddlewareHandler {
  return async (c, next) => {
    if (tokenMatches(config.token, bearer(c))) return next();
    if (tokenMatches(config.token, getCookie(c, COOKIE_NAME))) {
      if (!SAFE_METHODS.has(c.req.method) && !c.req.header("origin")) {
        return c.json(errorBody("forbidden_origin", "Origin required for cookie auth"), 403);
      }
      return next();
    }
    return c.json(errorBody("unauthorized", "Missing or invalid credentials"), 401);
  };
}
