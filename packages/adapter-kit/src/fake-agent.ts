import {
  withCapabilities,
  type AdapterProbe,
  type AgentAdapter,
  type AgentEventBody,
  type AgentRun,
  type ApprovalDecision,
  type UserInput,
} from "@openspaces/core";
import { EventChannel } from "./event-channel.js";

export const FAKE_TRIGGERS = {
  approval: "needs-approval",
  slow: "slow",
} as const;

class FakeRun implements AgentRun {
  private readonly channel = new EventChannel<AgentEventBody>();
  readonly events: AsyncIterable<AgentEventBody> = this.channel;
  private closed = false;
  private turn = 0;
  private pendingApproval: ((decision: ApprovalDecision) => void) | undefined;
  private abortTurn: (() => void) | undefined;

  constructor(private readonly stepDelayMs: number) {
    this.channel.push({ type: "session.started", externalSessionId: "fake-session" });
  }

  async send(input: UserInput): Promise<void> {
    if (this.closed) throw new Error("run is closed");
    void this.runTurn(input.text);
  }

  async interrupt(): Promise<void> {
    this.abortTurn?.();
  }

  async resolveApproval(_approvalId: string, decision: ApprovalDecision): Promise<void> {
    const resolve = this.pendingApproval;
    if (!resolve) throw new Error("no pending approval");
    this.pendingApproval = undefined;
    resolve(decision);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.abortTurn?.();
    this.pendingApproval?.("deny");
    this.channel.push({ type: "session.ended", reason: "closed" });
    this.channel.end();
  }

  private pause(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.stepDelayMs));
  }

  private async runTurn(text: string): Promise<void> {
    const turnId = ++this.turn;
    let interrupted = false;
    this.abortTurn = () => {
      interrupted = true;
    };
    const emit = (event: AgentEventBody): void => this.channel.push(event);
    const messageId = `m${turnId}`;

    emit({ type: "turn.started" });
    emit({ type: "thinking.delta", text: "thinking" });

    if (text.includes(FAKE_TRIGGERS.slow)) {
      for (let i = 0; i < 100 && !interrupted && !this.closed; i++) await this.pause();
      if (!this.closed) emit({ type: "turn.completed", stopReason: "interrupted" });
      return;
    }

    if (text.includes(FAKE_TRIGGERS.approval)) {
      const approvalId = `a${turnId}`;
      const toolCallId = `t${turnId}`;
      emit({ type: "tool.started", toolCallId, name: "shell", input: { command: "ls" } });
      emit({
        type: "approval.requested",
        approvalId,
        toolCallId,
        title: "Run shell command",
        options: [
          { decision: "allow_once", label: "Allow once" },
          { decision: "deny", label: "Deny" },
        ],
      });
      const decision = await new Promise<ApprovalDecision>((resolve) => {
        this.pendingApproval = resolve;
      });
      if (this.closed) return;
      emit({ type: "approval.resolved", approvalId, decision });
      if (decision === "deny") {
        emit({ type: "tool.completed", toolCallId, status: "error", output: "denied" });
      } else {
        emit({ type: "tool.output", toolCallId, chunk: "file.txt\n" });
        emit({ type: "tool.completed", toolCallId, status: "ok", output: "file.txt\n" });
      }
    }

    await this.pause();
    if (this.closed) return;
    emit({ type: "message.delta", messageId, text: "echo: " });
    emit({ type: "message.delta", messageId, text });
    emit({ type: "message.completed", messageId, role: "assistant", text: `echo: ${text}` });
    emit({ type: "usage.reported", inputTokens: text.length, outputTokens: text.length + 6 });
    emit({ type: "turn.completed", stopReason: "completed" });
  }
}

export interface FakeAgentOptions {
  stepDelayMs?: number;
}

export function createFakeAgent(options: FakeAgentOptions = {}): AgentAdapter {
  const stepDelayMs = options.stepDelayMs ?? 1;
  return {
    id: "fake",
    displayName: "Fake Agent",
    capabilities: withCapabilities({ approvals: true, interrupt: true, thinking: true }),
    probe: async (): Promise<AdapterProbe> => ({
      available: true,
      supported: true,
      version: "0.0.0",
    }),
    start: async (): Promise<AgentRun> => new FakeRun(stepDelayMs),
  };
}
