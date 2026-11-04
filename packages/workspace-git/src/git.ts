import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export async function git(cwd: string, args: readonly string[]): Promise<string> {
  const { stdout } = await run("git", ["-C", cwd, ...args], {
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return stdout.trim();
}

export async function tryGit(cwd: string, args: readonly string[]): Promise<string | undefined> {
  try {
    return await git(cwd, args);
  } catch {
    return undefined;
  }
}
