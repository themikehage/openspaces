import { describe, expect, it } from "vitest";
import { ClaudeTranslator } from "./translator.js";

describe("ClaudeTranslator", () => {
  it("maps streaming text and thinking deltas", () => {
    const t = new ClaudeTranslator();
    t.translate({ type: "stream_event", event: { type: "message_start", message: { id: "m1" } } });
    expect(
      t.translate({
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "hi" } },
      }),
    ).toEqual([{ type: "message.delta", messageId: "m1", text: "hi" }]);
    expect(
      t.translate({
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "thinking_delta", thinking: "hmm" } },
      }),
    ).toEqual([{ type: "thinking.delta", text: "hmm" }]);
  });

  it("maps assistant text and tool_use blocks", () => {
    const events = new ClaudeTranslator().translate({
      type: "assistant",
      message: {
        id: "m2",
        content: [
          { type: "text", text: "running" },
          { type: "tool_use", id: "tu1", name: "Bash", input: { command: "ls" } },
        ],
      },
    });
    expect(events).toEqual([
      { type: "message.completed", messageId: "m2", role: "assistant", text: "running" },
      { type: "tool.started", toolCallId: "tu1", name: "Bash", input: { command: "ls" } },
    ]);
  });

  it("maps tool results, including errors and block content", () => {
    const events = new ClaudeTranslator().translate({
      type: "user",
      message: {
        content: [
          { type: "tool_result", tool_use_id: "a", content: "ok" },
          { type: "tool_result", tool_use_id: "b", is_error: true, content: [{ text: "bad" }] },
        ],
      },
    });
    expect(events).toEqual([
      { type: "tool.completed", toolCallId: "a", status: "ok", output: "ok" },
      { type: "tool.completed", toolCallId: "b", status: "error", output: "bad" },
    ]);
  });

  it("ignores sub-agent traffic and unknown message kinds", () => {
    const t = new ClaudeTranslator();
    expect(t.translate({ type: "assistant", parent_tool_use_id: "x", message: {} })).toEqual([]);
    expect(t.translate({ type: "system", subtype: "init" })).toEqual([]);
  });

  it("reports usage and completion for a successful result", () => {
    const events = new ClaudeTranslator().translate({
      type: "result",
      subtype: "success",
      is_error: false,
      total_cost_usd: 0.02,
      usage: { input_tokens: 3, output_tokens: 4 },
    });
    expect(events).toEqual([
      { type: "usage.reported", inputTokens: 3, outputTokens: 4, costUsd: 0.02 },
      { type: "turn.completed", stopReason: "completed" },
    ]);
  });

  it("reports a non-fatal error for failed results", () => {
    const events = new ClaudeTranslator().translate({
      type: "result",
      subtype: "error_max_turns",
      is_error: true,
    });
    expect(events).toEqual([
      { type: "session.error", code: "error_max_turns", message: "error_max_turns", fatal: false },
      { type: "turn.completed", stopReason: "error" },
    ]);
  });

  it("reports interrupted turns without raising an error", () => {
    const t = new ClaudeTranslator();
    t.markInterrupted();
    const events = t.translate({
      type: "result",
      subtype: "error_during_execution",
      is_error: true,
    });
    expect(events).toEqual([{ type: "turn.completed", stopReason: "interrupted" }]);
    t.resetTurn();
    expect(t.translate({ type: "result", subtype: "success" }).at(-1)).toEqual({
      type: "turn.completed",
      stopReason: "completed",
    });
  });
});
