import type { AgentEventBody, TurnStopReason } from "@openspaces/core";
import { asArray, asNumber, asRecord, asString, stringifyContent } from "./guards.js";
import type { SdkMessageLike } from "./types.js";

export class ClaudeTranslator {
  private currentMessageId = "message";
  private interrupted = false;
  private lastCostUsd = 0;

  markInterrupted(): void {
    this.interrupted = true;
  }

  resetTurn(): void {
    this.interrupted = false;
  }

  translate(message: SdkMessageLike): AgentEventBody[] {
    if (message["parent_tool_use_id"]) return [];
    switch (message.type) {
      case "stream_event":
        return this.streamEvent(message);
      case "assistant":
        return this.assistant(message);
      case "user":
        return this.toolResults(message);
      case "result":
        return this.result(message);
      default:
        return [];
    }
  }

  private streamEvent(message: SdkMessageLike): AgentEventBody[] {
    const event = asRecord(message["event"]);
    if (!event) return [];
    if (event["type"] === "message_start") {
      const id = asString(asRecord(event["message"])?.["id"]);
      if (id) this.currentMessageId = id;
      return [];
    }
    if (event["type"] !== "content_block_delta") return [];
    const delta = asRecord(event["delta"]);
    if (delta?.["type"] === "text_delta") {
      const text = asString(delta["text"]);
      return text ? [{ type: "message.delta", messageId: this.currentMessageId, text }] : [];
    }
    if (delta?.["type"] === "thinking_delta") {
      const text = asString(delta["thinking"]);
      return text ? [{ type: "thinking.delta", text }] : [];
    }
    return [];
  }

  private assistant(message: SdkMessageLike): AgentEventBody[] {
    const body = asRecord(message["message"]);
    if (!body) return [];
    const messageId = asString(body["id"]) ?? this.currentMessageId;
    const events: AgentEventBody[] = [];
    const texts: string[] = [];
    for (const raw of asArray(body["content"])) {
      const block = asRecord(raw);
      if (block?.["type"] === "text") {
        const text = asString(block["text"]);
        if (text) texts.push(text);
      } else if (block?.["type"] === "tool_use") {
        const toolCallId = asString(block["id"]);
        const name = asString(block["name"]);
        if (toolCallId && name) {
          events.push({ type: "tool.started", toolCallId, name, input: block["input"] });
        }
      }
    }
    if (texts.length > 0) {
      events.unshift({
        type: "message.completed",
        messageId,
        role: "assistant",
        text: texts.join("\n"),
      });
    }
    return events;
  }

  private toolResults(message: SdkMessageLike): AgentEventBody[] {
    const content = asRecord(message["message"])?.["content"];
    const events: AgentEventBody[] = [];
    for (const raw of asArray(content)) {
      const block = asRecord(raw);
      const toolCallId = asString(block?.["tool_use_id"]);
      if (block?.["type"] !== "tool_result" || !toolCallId) continue;
      events.push({
        type: "tool.completed",
        toolCallId,
        status: block["is_error"] === true ? "error" : "ok",
        output: stringifyContent(block["content"]),
      });
    }
    return events;
  }

  private result(message: SdkMessageLike): AgentEventBody[] {
    const usage = asRecord(message["usage"]);
    const inputTokens = asNumber(usage?.["input_tokens"]);
    const outputTokens = asNumber(usage?.["output_tokens"]);
    const totalCost = asNumber(message["total_cost_usd"]);
    const costUsd = totalCost === undefined ? undefined : Math.max(0, totalCost - this.lastCostUsd);
    if (totalCost !== undefined) this.lastCostUsd = totalCost;
    const events: AgentEventBody[] = [];
    if (inputTokens !== undefined || outputTokens !== undefined || costUsd !== undefined) {
      events.push({
        type: "usage.reported",
        ...(inputTokens !== undefined ? { inputTokens } : {}),
        ...(outputTokens !== undefined ? { outputTokens } : {}),
        ...(costUsd !== undefined ? { costUsd } : {}),
      });
    }
    const failed = message["subtype"] !== "success" || message["is_error"] === true;
    const stopReason: TurnStopReason = this.interrupted
      ? "interrupted"
      : failed
        ? "error"
        : "completed";
    if (failed && !this.interrupted) {
      const detail = asString(message["result"]) ?? asString(message["subtype"]) ?? "unknown";
      events.push({
        type: "session.error",
        code: asString(message["subtype"]) ?? "turn_failed",
        message: detail,
        fatal: false,
      });
    }
    events.push({ type: "turn.completed", stopReason });
    return events;
  }
}
