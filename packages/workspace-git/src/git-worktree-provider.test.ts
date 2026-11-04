import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Logger } from "@openspaces/core";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GitWorktreeProvider } from "./git-worktree-provider.js";

const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };
const base = mkdtempSync(join(tmpdir(), "openspaces-git-"));
afterAll(() => rmSync(base, { recursive: true, force: true }));

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-C", cwd, "-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    encoding: "utf8",
  }).trim();

let repo: string;
let provider: GitWorktreeProvider;
let n = 0;

beforeEach(() => {
  n += 1;
  repo = join(base, `repo-${n}`);
  mkdirSync(join(repo, "pkg"), { recursive: true });
  execFileSync("git", ["init", "-q", "-b", "main", repo]);
  writeFileSync(join(repo, "pkg", "a.txt"), "a");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "init");
  provider = new GitWorktreeProvider({ root: join(base, `wt-${n}`), logger: silent });
});

describe("GitWorktreeProvider", () => {
  it("detects git repositories", async () => {
    expect(await provider.isGitRepo(repo)).toBe(true);
    expect(await provider.isGitRepo(base)).toBe(false);
  });

  it("creates an isolated worktree on its own branch", async () => {
    const ws = await provider.create({ projectPath: repo, sessionId: "s1", mode: "worktree" });
    expect(existsSync(join(ws.path, "pkg", "a.txt"))).toBe(true);
    expect(git(repo, "branch", "--list", "openspaces/s1")).toContain("openspaces/s1");
    writeFileSync(join(ws.path, "pkg", "a.txt"), "changed");
    expect(git(repo, "status", "--porcelain")).toBe("");
  });

  it("keeps the same sub-directory when the project is inside the repo", async () => {
    const ws = await provider.create({
      projectPath: join(repo, "pkg"),
      sessionId: "s2",
      mode: "worktree",
    });
    expect(ws.path.endsWith(join("s2", "pkg"))).toBe(true);
  });

  it("removes clean worktrees and their branch on dispose", async () => {
    const ws = await provider.create({ projectPath: repo, sessionId: "s3", mode: "worktree" });
    await ws.dispose();
    expect(existsSync(ws.path)).toBe(false);
    expect(git(repo, "branch", "--list", "openspaces/s3")).toBe("");
  });

  it("keeps worktrees that have uncommitted changes", async () => {
    const ws = await provider.create({ projectPath: repo, sessionId: "s4", mode: "worktree" });
    writeFileSync(join(ws.path, "new.txt"), "x");
    await ws.dispose();
    expect(existsSync(join(ws.path, "new.txt"))).toBe(true);
  });

  it("keeps worktrees that have new commits", async () => {
    const ws = await provider.create({ projectPath: repo, sessionId: "s5", mode: "worktree" });
    writeFileSync(join(ws.path, "c.txt"), "x");
    git(ws.path, "add", ".");
    git(ws.path, "commit", "-q", "-m", "work");
    await ws.dispose();
    expect(existsSync(ws.path)).toBe(true);
    expect(git(repo, "branch", "--list", "openspaces/s5")).toContain("openspaces/s5");
  });

  it("rejects non-repositories, empty repositories and unsafe ids", async () => {
    await expect(
      provider.create({ projectPath: base, sessionId: "x", mode: "worktree" }),
    ).rejects.toThrow(/not a git/);
    const empty = join(base, "empty");
    mkdirSync(empty);
    execFileSync("git", ["init", "-q", empty]);
    await expect(
      provider.create({ projectPath: empty, sessionId: "x", mode: "worktree" }),
    ).rejects.toThrow(/no commits/);
    await expect(
      provider.create({ projectPath: repo, sessionId: "../evil", mode: "worktree" }),
    ).rejects.toThrow(/Unsafe/);
  });
});
