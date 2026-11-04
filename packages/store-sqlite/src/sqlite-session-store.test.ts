import { runSessionStoreContract } from "@openspaces/adapter-kit/store-contract";
import { MemorySessionStore } from "@openspaces/core";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
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

  it("migrates a database created before workspace columns existed", async () => {
    const path = join(dir, `db-${++n}.sqlite`);
    const legacy = new DatabaseSync(path);
    legacy.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY, adapter_id TEXT NOT NULL, cwd TEXT NOT NULL, state TEXT NOT NULL,
        external_session_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE events (
        session_id TEXT NOT NULL, id INTEGER NOT NULL, ts INTEGER NOT NULL, payload TEXT NOT NULL,
        PRIMARY KEY (session_id, id)
      );
      INSERT INTO sessions VALUES ('old', 'fake', '/tmp', 'ended', NULL, 1, 1);
    `);
    legacy.close();

    const store = new SqliteSessionStore(path);
    expect(await store.get("old")).toMatchObject({ id: "old", state: "ended" });
    await store.create({
      id: "new",
      adapterId: "fake",
      cwd: "/w",
      projectPath: "/p",
      workspace: "worktree",
      state: "idle",
      createdAt: 2,
      updatedAt: 2,
    });
    expect(await store.get("new")).toMatchObject({ projectPath: "/p", workspace: "worktree" });
    store.close();
    const reopened = new SqliteSessionStore(path);
    expect((await reopened.list()).map((r) => r.id)).toEqual(["new", "old"]);
    reopened.close();
  });
});
