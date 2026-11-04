import { createInterface } from "node:readline";

if (process.argv.includes("--version")) {
  console.log("mock-acp 1.0.0");
  process.exit(0);
}

const send = (message) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
const update = (sessionId, body) =>
  send({ method: "session/update", params: { sessionId, update: body } });
const waiting = new Map();
let counter = 0;
let cancelSlow;

function ask(method, params) {
  const id = 10_000 + ++counter;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    send({ id, method, params });
  });
}

async function prompt(id, params) {
  const sessionId = params.sessionId;
  const text = params.prompt?.[0]?.text ?? "";

  if (text.includes("crash")) process.exit(3);

  if (text.includes("slow")) {
    update(sessionId, {
      sessionUpdate: "agent_thought_chunk",
      content: { type: "text", text: "thinking" },
    });
    await new Promise((resolve) => {
      cancelSlow = resolve;
    });
    return send({ id, result: { stopReason: "cancelled" } });
  }

  if (text.includes("needs-approval")) {
    update(sessionId, {
      sessionUpdate: "tool_call",
      toolCallId: "tc1",
      title: "Run ls",
      kind: "execute",
      status: "pending",
      rawInput: { command: "ls" },
    });
    const response = await ask("session/request_permission", {
      sessionId,
      toolCall: { toolCallId: "tc1", title: "Run ls", rawInput: { command: "ls" } },
      options: [
        { optionId: "yes", name: "Allow once", kind: "allow_once" },
        { optionId: "always", name: "Always allow", kind: "allow_always" },
        { optionId: "no", name: "Reject", kind: "reject_once" },
      ],
    });
    const outcome = response.result?.outcome;
    const allowed = outcome?.outcome === "selected" && outcome.optionId !== "no";
    update(sessionId, {
      sessionUpdate: "tool_call_update",
      toolCallId: "tc1",
      status: allowed ? "completed" : "failed",
      content: [
        { type: "content", content: { type: "text", text: allowed ? "file.txt" : "rejected" } },
      ],
    });
  }

  update(sessionId, {
    sessionUpdate: "agent_message_chunk",
    content: { type: "text", text: "echo: " },
  });
  update(sessionId, { sessionUpdate: "agent_message_chunk", content: { type: "text", text } });
  update(sessionId, {
    sessionUpdate: "usage_update",
    used: 10,
    size: 1000,
    cost: { amount: 0.01, currency: "USD" },
  });
  send({ id, result: { stopReason: "end_turn" } });
}

createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line);
  if (message.method === undefined && waiting.has(message.id)) {
    waiting.get(message.id)(message);
    waiting.delete(message.id);
    return;
  }
  const { id, method, params } = message;
  switch (method) {
    case "initialize":
      return send({
        id,
        result: { protocolVersion: 1, agentCapabilities: { loadSession: true }, authMethods: [] },
      });
    case "session/new":
      if (process.env.MOCK_AUTH === "required") {
        return send({ id, error: { code: -32000, message: "Authentication required" } });
      }
      return send({ id, result: { sessionId: `mock-${++counter}` } });
    case "session/load":
      update(params.sessionId, {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "old history" },
      });
      return send({ id, result: null });
    case "session/set_mode":
      return send({ id, result: null });
    case "session/prompt":
      return void prompt(id, params);
    case "session/cancel":
      return cancelSlow?.();
    default:
      if (id !== undefined) send({ id, error: { code: -32601, message: "Method not found" } });
  }
});
