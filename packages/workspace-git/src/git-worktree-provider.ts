import { mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  WorkspaceUnavailableError,
  type Logger,
  type Workspace,
  type WorkspaceProvider,
  type WorkspaceSpec,
} from "@openspaces/core";
import { git, tryGit } from "./git.js";

export interface GitWorktreeOptions {
  root: string;
  logger: Logger;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export class GitWorktreeProvider implements WorkspaceProvider {
  constructor(private readonly options: GitWorktreeOptions) {}

  async isGitRepo(path: string): Promise<boolean> {
    return (await tryGit(path, ["rev-parse", "--show-toplevel"])) !== undefined;
  }

  async create(spec: WorkspaceSpec): Promise<Workspace> {
    if (!SAFE_ID.test(spec.sessionId)) {
      throw new WorkspaceUnavailableError("Unsafe session id for a worktree");
    }
    const top = await tryGit(spec.projectPath, ["rev-parse", "--show-toplevel"]);
    if (!top) throw new WorkspaceUnavailableError("The project is not a git repository");
    const base = await tryGit(top, ["rev-parse", "--verify", "HEAD"]);
    if (!base) throw new WorkspaceUnavailableError("The repository has no commits yet");

    const branch = `openspaces/${spec.sessionId}`;
    const path = join(this.options.root, spec.sessionId);
    await mkdir(this.options.root, { recursive: true, mode: 0o700 });
    try {
      await git(top, ["worktree", "add", "-b", branch, "--", path, base]);
    } catch (error) {
      throw new WorkspaceUnavailableError(
        `Could not create the worktree: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
      );
    }

    const subdir = relative(top, spec.projectPath);
    const cwd = subdir && !subdir.startsWith("..") ? join(path, subdir) : path;
    return { path: cwd, dispose: () => this.dispose(top, path, branch, base) };
  }

  private async dispose(top: string, path: string, branch: string, base: string): Promise<void> {
    const dirty = (await tryGit(path, ["status", "--porcelain"])) !== "";
    const ahead = Number((await tryGit(path, ["rev-list", "--count", `${base}..HEAD`])) ?? "1");
    if (dirty || ahead > 0) {
      this.options.logger.info("kept worktree with changes", { path, branch });
      return;
    }
    await git(top, ["worktree", "remove", "--force", "--", path]);
    await tryGit(top, ["branch", "-D", "--", branch]);
  }
}
