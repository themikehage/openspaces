import { runAdapterContract } from "./contract.js";
import { createFakeAgent, FAKE_TRIGGERS } from "./fake-agent.js";

runAdapterContract({
  name: "fake",
  createAdapter: () => createFakeAgent(),
  cwd: () => process.cwd(),
  prompts: {
    simple: "hello",
    needsApproval: FAKE_TRIGGERS.approval,
    slow: FAKE_TRIGGERS.slow,
  },
});
