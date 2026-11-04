import type { AgentEventBody, ApprovalDecision, ApprovalOption } from "@openspaces/core";
import { asArray, asNumber, asRecord, asString, type Json } from "./guards.js";

export interface PermissionChoice {
  optionId: string;
  decision: ApprovalDecision;
  label: string;
}

export function textOfContent(content: unknown): string {
  const block = asRecord(content);
  return block?.["type"] === "text" ? (asString(block["text"]) ?? "") : "";
}

function textOfToolContent(content: unknown): string {
  return asArray(content)
    .map((entry) => {
      const item = asRecord(entry);
      if (item?.["type"] === "content") return textOfContent(item["content"]);
      if (item?.["type"] === "diff") return `diff ${asString(item["path"]) ?? ""}`.trim();
      return "";
    })
    .filter((text) => text !== "")
    .join("\n");
}

function stringifyRaw(value: unknown): string {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function permissionChoices(options: unknown[]): PermissionChoice[] {
  const choices: PermissionChoice[] = [];
  let denied = false;
  for (const raw of options) {
    const option = asRecord(raw);
    const optionId = asString(option?.["optionId"]);
    const kind = asString(option?.["kind"]);
    if (!option || !optionId) continue;
    const label = asString(option["name"]) ?? optionId;
    if (kind === "allow_once") choices.push({ optionId, decision: "allow_once", label });
    else if (kind === "allow_always") choices.push({ optionId, decision: "allow_session", label });
    else if ((kind === "reject_once" || kind === "reject_always") && !denied) {
      denied = true;
      choices.push({ optionId, decision: "deny", label });
    }
  }
  return choices;
}

export function toApprovalOptions(choices: PermissionChoice[]): ApprovalOption[] {
  return choices.map(({ decision, label }) => ({ decision, label }));
}

export class AcpTranslator {
  private messageId: string | undefined;
  private messageText = "";
  private messageCounter = 0;
  private lastCost = 0;

  translate(update: Json): AgentEventBody[] {
    switch (update["sessionUpdate"]) {
      case "agent_message_chunk":
        return this.messageChunk(update);
      case "agent_thought_chunk": {
        const text = textOfContent(update["content"]);
        return text ? [{ type: "thinking.delta", text }] : [];
      }
      case "tool_call":
        return [...this.flush(), ...this.toolCall(update)];
      case "tool_call_update":
        return this.toolUpdate(update);
      case "usage_update":
        return this.usage(update);
      default:
        return [];
    }
  }

  flush(): AgentEventBody[] {
    if (this.messageId === undefined) return [];
    const event: AgentEventBody = {
      type: "message.completed",
      messageId: this.messageId,
      role: "assistant",
      text: this.messageText,
    };
    this.messageId = undefined;
    this.messageText = "";
    return [event];
  }

  private messageChunk(update: Json): AgentEventBody[] {
    const text = textOfContent(update["content"]);
    if (!text) return [];
    const incoming = asString(update["messageId"]);
    const events: AgentEventBody[] = [];
    if (this.messageId !== undefined && incoming !== undefined && incoming !== this.messageId) {
      events.push(...this.flush());
    }
    if (this.messageId === undefined) {
      this.messageId = incoming ?? `acp-message-${++this.messageCounter}`;
    }
    this.messageText += text;
    events.push({ type: "message.delta", messageId: this.messageId, text });
    return events;
  }

  private toolCall(update: Json): AgentEventBody[] {
    const toolCallId = asString(update["toolCallId"]);
    if (!toolCallId) return [];
    const name =
      asString(update["title"]) ?? asString(update["name"]) ?? asString(update["kind"]) ?? "tool";
    const events: AgentEventBody[] = [
      {
        type: "tool.started",
        toolCallId,
        name,
        input: update["rawInput"] ?? { kind: update["kind"], locations: update["locations"] },
      },
    ];
    const done = this.completion(toolCallId, update);
    return done ? [...events, done] : events;
  }

  private toolUpdate(update: Json): AgentEventBody[] {
    const toolCallId = asString(update["toolCallId"]);
    if (!toolCallId) return [];
    const done = this.completion(toolCallId, update);
    return done ? [done] : [];
  }

  private completion(toolCallId: string, update: Json): AgentEventBody | undefined {
    const status = asString(update["status"]);
    if (status !== "completed" && status !== "failed") return undefined;
    const output = textOfToolContent(update["content"]) || stringifyRaw(update["rawOutput"]);
    return {
      type: "tool.completed",
      toolCallId,
      status: status === "completed" ? "ok" : "error",
      ...(output ? { output } : {}),
    };
  }

  private usage(update: Json): AgentEventBody[] {
    const cost = asRecord(update["cost"]);
    const amount = asNumber(cost?.["amount"]);
    if (amount === undefined || cost?.["currency"] !== "USD") return [];
    const delta = amount - this.lastCost;
    this.lastCost = amount;
    return delta > 0 ? [{ type: "usage.reported", costUsd: delta }] : [];
  }
}
