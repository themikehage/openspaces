import type { AgentEvent, AgentEventBody } from "@openspaces/core";
import { z } from "zod";

const decision = z.enum(["allow_once", "allow_session", "deny"]);

const approvalOption = z.object({ decision, label: z.string() });

export const agentEventBodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session.started"), externalSessionId: z.string().optional() }),
  z.object({ type: z.literal("turn.started") }),
  z.object({
    type: z.literal("turn.completed"),
    stopReason: z.enum(["completed", "interrupted", "error"]),
  }),
  z.object({ type: z.literal("message.delta"), messageId: z.string(), text: z.string() }),
  z.object({
    type: z.literal("message.completed"),
    messageId: z.string(),
    role: z.enum(["user", "assistant"]),
    text: z.string(),
  }),
  z.object({ type: z.literal("thinking.delta"), text: z.string() }),
  z.object({
    type: z.literal("tool.started"),
    toolCallId: z.string(),
    name: z.string(),
    input: z.unknown(),
  }),
  z.object({ type: z.literal("tool.output"), toolCallId: z.string(), chunk: z.string() }),
  z.object({
    type: z.literal("tool.completed"),
    toolCallId: z.string(),
    status: z.enum(["ok", "error"]),
    output: z.string().optional(),
  }),
  z.object({
    type: z.literal("approval.requested"),
    approvalId: z.string(),
    toolCallId: z.string().optional(),
    title: z.string(),
    details: z.unknown().optional(),
    options: z.array(approvalOption),
  }),
  z.object({ type: z.literal("approval.resolved"), approvalId: z.string(), decision }),
  z.object({
    type: z.literal("usage.reported"),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    costUsd: z.number().optional(),
  }),
  z.object({
    type: z.literal("session.error"),
    code: z.string(),
    message: z.string(),
    fatal: z.boolean(),
  }),
  z.object({
    type: z.literal("session.ended"),
    reason: z.enum(["completed", "closed", "failed"]),
  }),
]);

export const agentEventEnvelopeSchema = z.object({
  id: z.number().int().nonnegative(),
  ts: z.number(),
  sessionId: z.string(),
  schemaVersion: z.literal(1),
  raw: z.unknown().optional(),
});

export const agentEventSchema = z.intersection(agentEventBodySchema, agentEventEnvelopeSchema);

type Accepts<Schema, Domain> = Domain extends Schema ? true : false;

export const bodyMatchesCore: Accepts<z.input<typeof agentEventBodySchema>, AgentEventBody> = true;
export const eventMatchesCore: Accepts<z.input<typeof agentEventSchema>, AgentEvent> = true;
