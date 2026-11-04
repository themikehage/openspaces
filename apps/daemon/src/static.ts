import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import type { Hono } from "hono";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

async function tryRead(path: string): Promise<Buffer | undefined> {
  try {
    return await readFile(path);
  } catch {
    return undefined;
  }
}

export function mountWeb(app: Hono, webRoot: string): void {
  const root = normalize(webRoot);
  app.get("*", async (c) => {
    const pathname = decodeURIComponent(new URL(c.req.url).pathname);
    if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) return c.notFound();

    const target = normalize(join(root, pathname));
    const inside = target === root || target.startsWith(root + sep);
    const file = inside && pathname !== "/" ? await tryRead(target) : undefined;
    const body = file ?? (await tryRead(join(root, "index.html")));
    if (!body) return c.notFound();

    const type = file ? (TYPES[extname(target)] ?? "application/octet-stream") : TYPES[".html"];
    c.header("Content-Type", type ?? "application/octet-stream");
    c.header("Content-Security-Policy", CSP);
    if (file && pathname.startsWith("/assets/")) {
      c.header("Cache-Control", "public, max-age=31536000, immutable");
    }
    return c.body(new Uint8Array(body));
  });
}
