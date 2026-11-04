import { z } from "zod";

const decision = z.enum(["allow_once", "allow_session", "deny"]);

export const createSessionRequestSchema = z.object({
  adapterId: z.string().min(1).max(64),
  cwd: z.string().min(1).max(4096),
  resumeExternalSessionId: z.string().min(1).max(256).optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

export const promptRequestSchema = z.object({
  text: z.string().min(1).max(200_000),
});

export const approvalRequestSchema = z.object({ decision });

export const sessionStateSchema = z.enum([
  "created",
  "starting",
  "running",
  "awaiting_approval",
  "idle",
  "ended",
  "failed",
]);

export const sessionSchema = z.object({
  id: z.string(),
  adapterId: z.string(),
  cwd: z.string(),
  state: sessionStateSchema,
  externalSessionId: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const adapterInfoSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  capabilities: z.object({
    resume: z.boolean(),
    approvals: z.boolean(),
    interrupt: z.boolean(),
    mcp: z.boolean(),
    images: z.boolean(),
    thinking: z.boolean(),
  }),
  probe: z.object({
    available: z.boolean(),
    supported: z.boolean(),
    version: z.string().optional(),
    reason: z.string().optional(),
  }),
});

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;
export type PromptRequest = z.infer<typeof promptRequestSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type SessionDto = z.infer<typeof sessionSchema>;
export type AdapterInfoDto = z.infer<typeof adapterInfoSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
