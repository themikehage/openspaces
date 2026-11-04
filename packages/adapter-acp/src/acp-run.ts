import {
  AdapterStartError,
  type AgentEventBody,
  type AgentRun,
  type AgentStartSpec,
  type ApprovalDecision,
  type TurnStopReason,
  type UserInput,
} from "@openspaces/core";
import { EventChannel, spawnLineProcess, type LineProcess } from "@openspaces/adapter-kit";
import { asArray, asRecord, asString, type Json } from "./guards.js";
import { JsonRpcConnection, RpcError } from "./jsonrpc.js";
import type { AcpManifest } from "./manifest.js";
import {
  AcpTranslator,
  permissionChoices,
  toApprovalOptions,
  type PermissionChoice,
} from "./translator.js";

const PROTOCOL_VERSION = 1;
const AUTH_REQUIRED = -32000;

interface PendingApproval {
  choices: PermissionChoice[];
  settle: (outcome: Json) => void;
}

const STOP_REASONS: Record<string, TurnStopReason> = {
  end_turn: "completed",
  cancelled: "interrupted",
};

export class AcpRun implements AgentRun {
  private readonly out = new EventChannel<AgentEventBody>();
  readonly events: AsyncIterable<AgentEventBody> = this.out;
  private readonly translator = new AcpTranslator();
  private readonly approvals = new Map<string, PendingApproval>();
  private approvalCounter = 0;
  private suppressUpdates = true;
  private closed = false;
  private sessionId = "";

  private constructor(
    private readonly manifest: AcpManifest,
    private readonly proc: LineProcess,
    private readonly rpc: JsonRpcConnection,
  ) {
    rpc.onNotification("session/update", (params) => this.onUpdate(params));
    rpc.onRequest("session/request_permission", (params) => this.onPermission(params));
    proc.onExit(() => this.onExit());
  }

  static async start(manifest: AcpManifest, spec: AgentStartSpec): Promise<AcpRun> {
    const proc = spawnLineProcess({
      command: manifest.command,
      args: manifest.args,
      cwd: spec.cwd,
      env: { ...manifest.env, ...spec.env },
    });
    const rpc = new JsonRpcConnection(proc);
    const run = new AcpRun(manifest, proc, rpc);
    try {
      await run.handshake(spec);
    } catch (error) {
      await proc.stop();
      throw run.startError(error);
    }
    run.suppressUpdates = false;
    run.out.push({ type: "session.started", externalSessionId: run.sessionId });
    return run;
  }

  async send(input: UserInput): Promise<void> {
    if (this.closed) throw new Error("run is closed");
    this.out.push({ type: "turn.started" });
    void this.prompt(input.text);
  }

  async interrupt(): Promise<void> {
    if (this.closed) return;
    this.cancelApprovals();
    this.rpc.notify("session/cancel", { sessionId: this.sessionId });
  }

  async resolveApproval(approvalId: string, decision: ApprovalDecision): Promise<void> {
    const pending = this.approvals.get(approvalId);
    if (!pending) throw new Error(`No pending approval ${approvalId}`);
    const choice =
      pending.choices.find((candidate) => candidate.decision === decision) ??
      (decision === "allow_session"
        ? pending.choices.find((candidate) => candidate.decision === "allow_once")
        : undefined);
    if (!choice) throw new Error(`Decision "${decision}" is not available for this request`);
    pending.settle({ outcome: "selected", optionId: choice.optionId });
    this.out.push({ type: "approval.resolved", approvalId, decision: choice.decision });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.cancelApprovals();
    this.rpc.rejectAll(new Error("run closed"));
    await this.proc.stop();
    this.out.push({ type: "session.ended", reason: "closed" });
    this.out.end();
  }

  private async handshake(spec: AgentStartSpec): Promise<void> {
    const init = asRecord(
      await this.rpc.request("initialize", {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      }),
    );
    const agentVersion = init?.["protocolVersion"];
    if (agentVersion !== PROTOCOL_VERSION) {
      throw new Error(`Unsupported ACP protocol version ${String(agentVersion)}`);
    }
    const loadSupported = asRecord(init?.["agentCapabilities"])?.["loadSession"] === true;
    const resumeId = spec.resumeExternalSessionId;
    if (resumeId && !loadSupported) throw new Error("This agent cannot resume sessions");

    if (resumeId) {
      await this.rpc.request("session/load", {
        sessionId: resumeId,
        cwd: spec.cwd,
        mcpServers: [],
      });
      this.sessionId = resumeId;
    } else {
      const created = asRecord(
        await this.rpc.request("session/new", { cwd: spec.cwd, mcpServers: [] }),
      );
      this.sessionId = asString(created?.["sessionId"]) ?? "";
      if (!this.sessionId) throw new Error("Agent did not return a session id");
    }

    const requested = asString(spec.options?.["mode"]);
    const mode = requested ?? this.manifest.defaultMode;
    if (mode) {
      try {
        await this.rpc.request("session/set_mode", { sessionId: this.sessionId, modeId: mode });
      } catch (error) {
        if (requested) throw error;
      }
    }
  }

  private startError(error: unknown): AdapterStartError {
    const detail = error instanceof Error ? error.message : String(error);
    const stderr = this.proc.stderrTail().trim().split("\n").at(-1) ?? "";
    if (error instanceof RpcError && error.code === AUTH_REQUIRED) {
      return new AdapterStartError(
        this.manifest.id,
        this.manifest.authHint ?? "authentication required",
      );
    }
    const suffix = this.proc.exited && stderr ? ` (${stderr.slice(0, 200)})` : "";
    return new AdapterStartError(this.manifest.id, `${detail}${suffix}`);
  }

  private async prompt(text: string): Promise<void> {
    let stopReason: TurnStopReason = "error";
    try {
      const result = asRecord(
        await this.rpc.request("session/prompt", {
          sessionId: this.sessionId,
          prompt: [{ type: "text", text }],
        }),
      );
      const reason = asString(result?.["stopReason"]) ?? "end_turn";
      stopReason = STOP_REASONS[reason] ?? "error";
      this.emitAll(this.translator.flush());
      if (stopReason === "error") {
        this.out.push({
          type: "session.error",
          code: reason,
          message: `Turn stopped: ${reason}`,
          fatal: false,
        });
      }
    } catch (error) {
      if (this.closed) return;
      this.emitAll(this.translator.flush());
      const message = error instanceof Error ? error.message : String(error);
      this.out.push({ type: "session.error", code: "prompt_failed", message, fatal: false });
    }
    if (!this.closed) this.out.push({ type: "turn.completed", stopReason });
  }

  private onUpdate(params: Json): void {
    if (this.suppressUpdates || this.closed) return;
    const update = asRecord(params["update"]);
    if (update) this.emitAll(this.translator.translate(update));
  }

  private onPermission(params: Json): Promise<Json> {
    const choices = permissionChoices(asArray(params["options"]));
    const toolCall = asRecord(params["toolCall"]);
    const approvalId = `acp-approval-${++this.approvalCounter}`;
    const toolCallId = asString(toolCall?.["toolCallId"]);
    return new Promise<Json>((resolve) => {
      this.approvals.set(approvalId, {
        choices,
        settle: (outcome) => {
          this.approvals.delete(approvalId);
          resolve({ outcome });
        },
      });
      this.out.push({
        type: "approval.requested",
        approvalId,
        ...(toolCallId ? { toolCallId } : {}),
        title: asString(toolCall?.["title"]) ?? "Permission requested",
        ...(toolCall?.["rawInput"] !== undefined ? { details: toolCall["rawInput"] } : {}),
        options: toApprovalOptions(choices),
      });
    });
  }

  private cancelApprovals(): void {
    for (const [approvalId, pending] of [...this.approvals]) {
      pending.settle({ outcome: "cancelled" });
      if (!this.closed) this.out.push({ type: "approval.resolved", approvalId, decision: "deny" });
    }
  }

  private emitAll(events: AgentEventBody[]): void {
    for (const event of events) this.out.push(event);
  }

  private onExit(): void {
    if (this.closed) return;
    this.closed = true;
    this.rpc.rejectAll(new Error("agent process exited"));
    const tail = this.proc.stderrTail().trim().split("\n").at(-1) ?? "";
    this.out.push({
      type: "session.error",
      code: "agent_exited",
      message: tail ? `Agent process exited: ${tail.slice(0, 200)}` : "Agent process exited",
      fatal: true,
    });
    this.out.push({ type: "session.ended", reason: "failed" });
    this.out.end();
  }
}
