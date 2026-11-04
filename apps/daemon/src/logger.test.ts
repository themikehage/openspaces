import { describe, expect, it } from "vitest";
import { createLogger, redact } from "./logger.js";

describe("logger", () => {
  it("redacts sensitive keys at any depth", () => {
    expect(
      redact({
        id: 1,
        token: "abc",
        nested: { Authorization: "Bearer x", ok: true },
        list: [{ apiKey: "k" }],
      }),
    ).toEqual({
      id: 1,
      token: "[redacted]",
      nested: { Authorization: "[redacted]", ok: true },
      list: [{ apiKey: "[redacted]" }],
    });
  });

  it("writes structured lines without leaking secrets", () => {
    const lines: string[] = [];
    createLogger((line) => lines.push(line)).warn("rejected", { cookie: "secret-value", id: "s1" });
    const entry = JSON.parse(lines[0] ?? "{}");
    expect(entry).toMatchObject({
      level: "warn",
      message: "rejected",
      id: "s1",
      cookie: "[redacted]",
    });
    expect(lines[0]).not.toContain("secret-value");
  });
});
