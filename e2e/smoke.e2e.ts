import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PORT = 3377;
const root = join(import.meta.dirname, "..");
let daemon: ChildProcess;
let browser: Browser;
let page: Page;
let exchangeUrl = "";
const dirs: string[] = [];

function waitForUrl(child: ChildProcess): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("daemon did not start")), 30_000);
    child.stdout?.on("data", (chunk: Buffer) => {
      const match = /Open: (http\S+)/.exec(chunk.toString());
      if (match?.[1]) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on("exit", () => reject(new Error("daemon exited")));
  });
}

beforeAll(async () => {
  const data = mkdtempSync(join(tmpdir(), "openspaces-e2e-data-"));
  const project = mkdtempSync(join(tmpdir(), "openspaces-e2e-project-"));
  dirs.push(data, project);
  daemon = spawn(
    "pnpm",
    ["--filter", "@openspaces/daemon", "exec", "tsx", "src/main.ts", "--project", project],
    {
      cwd: root,
      env: {
        ...process.env,
        OPENSPACES_FAKE: "1",
        OPENSPACES_DATA_DIR: data,
        OPENSPACES_PORT: String(PORT),
      },
    },
  );
  exchangeUrl = await waitForUrl(daemon);
  browser = await chromium.launch();
  page = await (await browser.newContext({ viewport: { width: 1100, height: 760 } })).newPage();
});

afterAll(async () => {
  await browser?.close();
  daemon?.kill();
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe("web UI smoke", () => {
  it("logs in, runs a prompt with an approval and shows the result", async () => {
    await page.goto(exchangeUrl);
    await page.getByRole("button", { name: "New" }).click();
    await page.getByLabel("Agent").selectOption({ label: "Fake Agent 0.0.0" });
    await page.getByRole("button", { name: "Start session" }).click();

    await page.getByLabel("Prompt").fill("needs-approval please");
    await page.getByRole("button", { name: "Send" }).click();

    const card = page.getByRole("region", { name: "Approval request" });
    await card.waitFor();
    await page.screenshot({ path: join(root, "e2e", "approval.png") });
    await card.getByRole("button", { name: "Allow once" }).click();

    await page.getByText("echo: needs-approval please").waitFor();
    await page.getByText("Allowed once").waitFor();
    await page.screenshot({ path: join(root, "e2e", "done.png") });
  });

  it("interrupts a slow turn", async () => {
    await page.getByLabel("Prompt").fill("slow");
    await page.getByRole("button", { name: "Send" }).click();
    await page.getByRole("button", { name: "Interrupt" }).click();
    await page.getByText("Interrupted").waitFor();
  });

  it("ends the session and locks the prompt", async () => {
    await page.getByRole("button", { name: "End", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector<HTMLTextAreaElement>("#prompt")?.disabled === true,
    );
  });

  it("rejects pages without the login cookie when calling the API", async () => {
    const context = await browser.newContext();
    const response = await context.request.get(`http://127.0.0.1:${PORT}/api/sessions`);
    expect(response.status()).toBe(401);
    await context.close();
  });
});
