import { runAdapterContract } from "@openspaces/adapter-kit/contract";
import { EventChannel, FAKE_TRIGGERS } from "@openspaces/adapter-kit";
import { describe, expect, it } from "vitest";
import { createClaudeCodeAdapter } from "./claude-code-adapter.js";
import type { ClaudeQuery, QueryFn, SdkMessageLike } from "./types.js";

function textOf(content: unknown): string {
  return typeof content === "string" ? content : "";
}

const scriptedQuery: QueryFn = ({ prompt, options }) => {
  const out = new EventChannel<SdkMessageLike>();
  let releaseSlow: (() => void) | undefined;
  const result = (extra: Record<string, unknown> = {}): SdkMessageLike => ({
    type: "result",
    subtype: "success",
    is_error: false,
    total_cost_usd: 0.001,
    usage: { input_tokens: 1, output_tokens: 1 },
    ...extra,
  });

  void (async () => {
    for await (const message of prompt) {
      const text = textOf(message.message.content);
      if (text.includes(FAKE_TRIGGERS.slow)) {
        await new Promise<void>((resolve) => {
          releaseSlow = resolve;
        });
        out.push(result({ subtype: "error_during_execution", is_error: true }));
        continue;
      }
      if (text.includes(FAKE_TRIGGERS.approval)) {
        const verdict = await options.canUseTool?.("Bash", { command: "ls" }, {
          signal: new AbortController().signal,
          toolUseID: "tu1",
          suggestions: [],
        } as unknown as Parameters<NonNullable<typeof options.canUseTool>>[2]);
        if (verdict?.behavior === "deny") {
          out.push({
            type: "user",
            message: {
              content: [
                { type: "tool_result", tool_use_id: "tu1", is_error: true, content: "denied" },
              ],
            },
          });
        }
      }
      out.push({
        type: "stream_event",
        event: { type: "content_block_delta", delta: { type: "text_delta", text: "ok" } },
      });
      out.push({
        type: "assistant",
        message: { id: "m1", content: [{ type: "text", text: `echo: ${text}` }] },
      });
      out.push(result());
    }
  })();

  const query: ClaudeQuery = {
    [Symbol.asyncIterator]: () => out[Symbol.asyncIterator](),
    interrupt: async () => releaseSlow?.(),
    close: () => out.end(),
  };
  return query;
};

runAdapterContract({
  name: "claude-code (scripted query)",
  createAdapter: () =>
    createClaudeCodeAdapter({
      queryFn: scriptedQuery,
      readVersion: async () => "2.1.0 (Claude Code)",
    }),
  cwd: () => process.cwd(),
  prompts: {
    simple: "hello",
    needsApproval: FAKE_TRIGGERS.approval,
    slow: FAKE_TRIGGERS.slow,
  },
});

describe("claude-code adapter specifics", () => {
  it("resumes with the given external session id", async () => {
    let seen: string | undefined;
    const adapter = createClaudeCodeAdapter({
      queryFn: (params) => {
        seen = params.options.resume;
        return scriptedQuery(params);
      },
    });
    const run = await adapter.start({ cwd: ".", resumeExternalSessionId: "abc" });
    const first = await run.events[Symbol.asyncIterator]().next();
    expect(first.value).toEqual({ type: "session.started", externalSessionId: "abc" });
    expect(seen).toBe("abc");
    await run.close();
  });

  it("reports unavailable when the binary is missing", async () => {
    const adapter = createClaudeCodeAdapter({ binary: "definitely-not-a-real-binary" });
    expect(await adapter.probe()).toMatchObject({ available: false, supported: false });
  });
});
