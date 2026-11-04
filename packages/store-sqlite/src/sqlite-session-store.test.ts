import { runSessionStoreContract } from "@openspaces/adapter-kit/store-contract";
import { MemorySessionStore } from "@openspaces/core";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { SqliteSessionStore } from "./sqlite-session-store.js";

const dir = mkdtempSync(join(tmpdir(), "openspaces-store-"));
let n = 0;
afterAll(() => rmSync(dir, { recursive: true, force: true }));

runSessionStoreContract("memory", () => new MemorySessionStore());
runSessionStoreContract("sqlite (in memory)", () => new SqliteSessionStore(":memory:"));

describe("SqliteSessionStore persistence", () => {
  it("survives reopening the database file", async () => {
    const path = join(dir, `db-${++n}.sqlite`);
    const first = new SqliteSessionStore(path);
    await first.create({
      id: "a",
      adapterId: "fake",
      cwd: "/tmp",
      state: "idle",
      createdAt: 1,
      updatedAt: 1,
    });
    await first.appendEvent("a", { type: "turn.started" }, 2);
    first.close();

    const second = new SqliteSessionStore(path);
    expect((await second.get("a"))?.state).toBe("idle");
    expect(await second.readEvents("a")).toHaveLength(1);
    second.close();
  });
});
