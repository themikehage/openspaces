const COLORS = ["#6d4aff", "#14b8a6", "#ff7a59", "#3b82f6", "#ec4899", "#f59e0b", "#64748b"];

function colorFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length] ?? "#64748b";
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, backgroundColor: colorFor(name) }}
      className="inline-flex shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
