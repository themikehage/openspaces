import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");

const allowed: Record<string, readonly string[]> = {
  core: [],
  protocol: ["@openspaces/core", "zod"],
  "adapter-claude-code": [
    "@anthropic-ai/claude-agent-sdk",
    "@openspaces/adapter-kit",
    "@openspaces/core",
  ],
  "api-client": ["@openspaces/core", "@openspaces/protocol", "zod"],
  "store-sqlite": ["@openspaces/core"],
  "adapter-kit": ["@openspaces/core", "@openspaces/protocol", "vitest"],
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

function tsxSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxSources(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

function externalImports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const specs = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1] ?? "");
  return specs
    .filter((spec) => !spec.startsWith(".") && !spec.startsWith("node:"))
    .map((spec) =>
      spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : (spec.split("/")[0] ?? spec),
    );
}

describe("architecture", () => {
  for (const [pkg, deps] of Object.entries(allowed)) {
    it(`${pkg} only imports ${deps.length ? deps.join(", ") : "nothing external"}`, () => {
      const dir = join(root, "packages", pkg, "src");
      const violations = sources(dir)
        .filter((file) => !file.endsWith(".test.ts"))
        .flatMap((file) =>
          externalImports(file)
            .filter((spec) => !deps.includes(spec))
            .map((spec) => `${relative(root, file)} -> ${spec}`),
        );
      expect(violations).toEqual([]);
    });
  }

  it("core declares no runtime dependencies", () => {
    const manifest = JSON.parse(readFileSync(join(root, "packages/core/package.json"), "utf8"));
    expect(manifest.dependencies ?? {}).toEqual({});
  });

  it("every package has a rule", () => {
    const packages = readdirSync(join(root, "packages"));
    expect(packages.sort()).toEqual(Object.keys(allowed).sort());
  });

  describe("web app", () => {
    const webSrc = join(root, "apps", "web", "src");
    const files = () =>
      sources(webSrc)
        .concat(tsxSources(webSrc))
        .filter((f) => !f.includes(".test."));

    it("does not call fetch directly", () => {
      const offenders = files().filter((f) => /\bfetch\(/.test(readFileSync(f, "utf8")));
      expect(offenders.map((f) => relative(root, f))).toEqual([]);
    });

    it("does not use deep relative imports", () => {
      const offenders = files().filter((f) => /from\s+["']\.\.\//.test(readFileSync(f, "utf8")));
      expect(offenders.map((f) => relative(root, f))).toEqual([]);
    });
  });
});
