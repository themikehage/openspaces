import { OpenSpacesError } from "@openspaces/core";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { errorBody } from "./security.js";

const STATUS: Record<string, ContentfulStatusCode> = {
  unknown_adapter: 404,
  unknown_session: 404,
  session_not_live: 409,
  invalid_transition: 409,
  project_not_registered: 403,
  duplicate_adapter: 500,
};

export function handleError(error: Error, c: Context): Response {
  if (error instanceof ZodError) {
    return c.json(errorBody("invalid_request", error.issues.map((i) => i.message).join("; ")), 400);
  }
  if (error instanceof OpenSpacesError) {
    return c.json(errorBody(error.code, error.message), STATUS[error.code] ?? 400);
  }
  return c.json(errorBody("internal_error", "Unexpected server error"), 500);
}
