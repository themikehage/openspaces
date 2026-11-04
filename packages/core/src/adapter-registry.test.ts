import { describe, expect, it } from "vitest";
import { AdapterRegistry } from "./adapter-registry.js";
import { NO_CAPABILITIES } from "./capabilities.js";
import { DuplicateAdapterError, UnknownAdapterError } from "./errors.js";
import type { AgentAdapter } from "./ports.js";

function stub(id: string): AgentAdapter {
  return {
    id,
    displayName: id,
    capabilities: NO_CAPABILITIES,
    probe: async () => ({ available: true, supported: true }),
    start: async () => {
      throw new Error("not used");
    },
  };
}

describe("AdapterRegistry", () => {
  it("registers and retrieves adapters", () => {
    const registry = new AdapterRegistry();
    registry.register(stub("a"));
    registry.register(stub("b"));
    expect(registry.get("a").id).toBe("a");
    expect(registry.list().map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("rejects duplicates and unknown ids", () => {
    const registry = new AdapterRegistry();
    registry.register(stub("a"));
    expect(() => registry.register(stub("a"))).toThrow(DuplicateAdapterError);
    expect(() => registry.get("zzz")).toThrow(UnknownAdapterError);
  });
});
