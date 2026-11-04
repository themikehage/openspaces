export type Json = Record<string, unknown>;

export function asRecord(value: unknown): Json | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Json)
    : undefined;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function stringifyContent(value: unknown): string {
  if (typeof value === "string") return value;
  const blocks = asArray(value)
    .map((block) => asString(asRecord(block)?.text))
    .filter((text): text is string => text !== undefined);
  if (blocks.length > 0) return blocks.join("\n");
  return value === undefined ? "" : JSON.stringify(value);
}
