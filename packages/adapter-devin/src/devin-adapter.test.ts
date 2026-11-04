import { describe, expect, it } from "vitest";
import { createDevinAdapter } from "./devin-adapter.js";
import {
  createDevinManifest,
  DEVIN_LOGIN_HINT,
  interpretAuthStatus,
  isSupportedDevinVersion,
  parseDevinVersion,
} from "./manifest.js";

describe("devin manifest", () => {
  it("parses versions from `devin --version`", () => {
    expect(parseDevinVersion("devin 3000.11.234 (92c83011d113)\n")).toBe("3000.11.234");
    expect(parseDevinVersion("garbage")).toBe("");
    expect(isSupportedDevinVersion("3000.11.234")).toBe(true);
    expect(isSupportedDevinVersion("")).toBe(false);
  });

  it("detects a missing login from `devin auth status`", () => {
    expect(
      interpretAuthStatus("Not logged in.\n  Credentials path: /x\nRun `devin auth login`"),
    ).toEqual({
      ready: false,
      reason: DEVIN_LOGIN_HINT,
    });
    expect(interpretAuthStatus("Logged in as someone@example.com")).toEqual({ ready: true });
  });

  it("runs the ACP server in the safe default mode", () => {
    const manifest = createDevinManifest();
    expect(manifest.args).toEqual(["acp"]);
    expect(manifest.defaultMode).toBe("accept-edits");
    expect(manifest.capabilities).toMatchObject({ resume: true, approvals: true, interrupt: true });
  });

  it("reports unavailable when the binary is missing", async () => {
    const adapter = createDevinAdapter("definitely-not-devin");
    expect(adapter.id).toBe("devin");
    expect(await adapter.probe()).toMatchObject({ available: false, supported: false });
  });
});
