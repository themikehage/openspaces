import type { SessionRecord, SessionStore } from "@openspaces/core";
import { describe, expect, it } from "vitest";

function record(id: string, createdAt = 1): SessionRecord {
  return { id, adapterId: "fake", cwd: "/tmp", state: "created", createdAt, updatedAt: createdAt };
}

export function runSessionStoreContract(name: string, create: () => SessionStore): void {
  describe(`session store contract: ${name}`, () => {
    it("creates, gets and lists sessions newest first", async () => {
      const store = create();
      await store.create(record("a", 1));
      await store.create(record("b", 2));
      expect(await store.get("a")).toEqual(record("a", 1));
      expect(await store.get("zzz")).toBeUndefined();
      expect((await store.list()).map((s) => s.id)).toEqual(["b", "a"]);
    });

    it("updates state and external id", async () => {
      const store = create();
      await store.create(record("a"));
      const updated = await store.update("a", { state: "idle", externalSessionId: "x" }, 9);
      expect(updated).toMatchObject({ state: "idle", externalSessionId: "x", updatedAt: 9 });
      expect(await store.get("a")).toEqual(updated);
      await expect(store.update("nope", { state: "idle" }, 1)).rejects.toThrow();
    });

    it("assigns monotonic per-session event ids and reads after a cursor", async () => {
      const store = create();
      await store.create(record("a"));
      await store.create(record("b"));
      const first = await store.appendEvent("a", { type: "turn.started" }, 10);
      await store.appendEvent("b", { type: "turn.started" }, 11);
      const second = await store.appendEvent(
        "a",
        { type: "message.delta", messageId: "m", text: "hi" },
        12,
      );
      expect([first.id, second.id]).toEqual([1, 2]);
      expect(second).toMatchObject({ sessionId: "a", ts: 12, schemaVersion: 1, text: "hi" });
      expect((await store.readEvents("a")).map((e) => e.id)).toEqual([1, 2]);
      expect((await store.readEvents("a", 1)).map((e) => e.id)).toEqual([2]);
      expect(await store.readEvents("a", 0, 1)).toHaveLength(1);
      expect(await store.readEvents("missing")).toEqual([]);
    });

    it("rejects events for unknown sessions", async () => {
      await expect(create().appendEvent("nope", { type: "turn.started" }, 1)).rejects.toThrow();
    });
  });
}
