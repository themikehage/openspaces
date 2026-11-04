import { randomUUID } from "node:crypto";
import type { CanUseTool, PermissionResult, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type {
  AgentEventBody,
  AgentRun,
  AgentStartSpec,
  ApprovalDecision,
  UserInput,
} from "@openspaces/core";
import { EventChannel } from "@openspaces/adapter-kit";
import { ClaudeTranslator } from "./translator.js";
import type { ClaudeQuery, QueryFn } from "./types.js";

type Suggestions = Parameters<CanUseTool>[2]["suggestions"];

export class ClaudeRun implements AgentRun {
  private readonly out = new EventChannel<AgentEventBody>();
  readonly events: AsyncIterable<AgentEventBody> = this.out;
  private readonly input = new EventChannel<SDKUserMessage>();
  private readonly translator = new ClaudeTranslator();
  private readonly pending = new Map<string, (decision: ApprovalDecision) => void>();
  private readonly abort = new AbortController();
  private readonly query: ClaudeQuery;
  private turnActive = false;
  private closed = false;

  constructor(queryFn: QueryFn, spec: AgentStartSpec) {
    const resumeId = spec.resumeExternalSessionId;
    const sessionId = resumeId ?? randomUUID();
    const permissionMode = spec.options?.["permissionMode"];
    this.query = queryFn({
      prompt: this.input,
      options: {
        cwd: spec.cwd,
        includePartialMessages: true,
        abortController: this.abort,
        canUseTool: this.canUseTool,
        ...(resumeId ? { resume: resumeId } : { sessionId }),
        ...(spec.env ? { env: { ...process.env, ...spec.env } } : {}),
        ...(typeof permissionMode === "string"
          ? { permissionMode: permissionMode as "default" | "acceptEdits" | "plan" }
          : {}),
      },
    });
    this.out.push({ type: "session.started", externalSessionId: sessionId });
    void this.pump();
  }

  async send(text: UserInput): Promise<void> {
    if (this.closed) throw new Error("run is closed");
    this.translator.resetTurn();
    this.turnActive = true;
    this.out.push({ type: "turn.started" });
    this.input.push({
      type: "user",
      message: { role: "user", content: text.text },
      parent_tool_use_id: null,
    });
  }

  async interrupt(): Promise<void> {
    if (this.closed || !this.turnActive) return;
    this.translator.markInterrupted();
    await this.query.interrupt();
  }

  async resolveApproval(approvalId: string, decision: ApprovalDecision): Promise<void> {
    const resolve = this.pending.get(approvalId);
    if (!resolve) throw new Error(`No pending approval ${approvalId}`);
    this.pending.delete(approvalId);
    resolve(decision);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const entry of this.pending.values()) entry("deny");
    this.pending.clear();
    this.input.end();
    this.abort.abort();
    this.query.close();
    this.out.push({ type: "session.ended", reason: "closed" });
    this.out.end();
  }

  private readonly canUseTool: CanUseTool = async (toolName, toolInput, options) => {
    const approvalId = randomUUID();
    const decision = await new Promise<ApprovalDecision>((resolve) => {
      this.pending.set(approvalId, resolve);
      options.signal.addEventListener("abort", () => resolve("deny"), { once: true });
      const choices: AgentEventBody & { type: "approval.requested" } = {
        type: "approval.requested",
        approvalId,
        title: `Use tool ${toolName}`,
        details: toolInput,
        options: [
          { decision: "allow_once", label: "Allow once" },
          ...(options.suggestions?.length
            ? [{ decision: "allow_session" as const, label: "Allow for this session" }]
            : []),
          { decision: "deny", label: "Deny" },
        ],
        ...(options.toolUseID ? { toolCallId: options.toolUseID } : {}),
      };
      this.out.push(choices);
    });
    this.pending.delete(approvalId);
    this.out.push({ type: "approval.resolved", approvalId, decision });
    return toPermissionResult(decision, toolInput, options.suggestions);
  };

  private async pump(): Promise<void> {
    try {
      for await (const message of this.query) {
        for (const event of this.translator.translate(message)) {
          if (event.type === "turn.completed") this.turnActive = false;
          this.out.push(event);
        }
      }
    } catch (error) {
      if (this.closed) return;
      this.out.push({
        type: "session.error",
        code: "claude_stream_failed",
        message: error instanceof Error ? error.message : String(error),
        fatal: true,
      });
    }
    if (!this.closed) {
      this.closed = true;
      this.out.push({ type: "session.ended", reason: "failed" });
      this.out.end();
    }
  }
}

function toPermissionResult(
  decision: ApprovalDecision,
  input: Record<string, unknown>,
  suggestions: Suggestions,
): PermissionResult {
  if (decision === "deny") return { behavior: "deny", message: "Denied by the user" };
  return {
    behavior: "allow",
    updatedInput: input,
    ...(decision === "allow_session" && suggestions ? { updatedPermissions: suggestions } : {}),
  };
}
