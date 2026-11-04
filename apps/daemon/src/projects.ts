import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { OpenSpacesError } from "@openspaces/core";

export class ProjectNotRegisteredError extends OpenSpacesError {
  constructor(path: string) {
    super("project_not_registered", `"${path}" is not inside a registered project`);
  }
}

export class ProjectGuard {
  private constructor(private readonly roots: readonly string[]) {}

  static async create(paths: readonly string[]): Promise<ProjectGuard> {
    return new ProjectGuard(await Promise.all(paths.map((path) => realpath(resolve(path)))));
  }

  list(): readonly string[] {
    return this.roots;
  }

  async resolve(cwd: string): Promise<string> {
    let real: string;
    try {
      real = await realpath(resolve(cwd));
    } catch {
      throw new ProjectNotRegisteredError(cwd);
    }
    const inside = this.roots.some((root) => {
      const rel = relative(root, real);
      return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
    });
    if (!inside) throw new ProjectNotRegisteredError(cwd);
    return real;
  }
}
