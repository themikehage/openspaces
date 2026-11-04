export function formatCost(usd: number): string {
  return usd === 0 ? "" : `$${usd.toFixed(usd < 0.01 ? 4 : 2)}`;
}

export function shortPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length <= 2 ? path : `…/${parts.slice(-2).join("/")}`;
}

export function stringifyInput(input: unknown): string {
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input, null, 2) ?? "";
  } catch {
    return String(input);
  }
}
