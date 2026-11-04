import type { TimelineItem } from "@/lib/timeline";

export function ThinkingItem({ item }: { item: Extract<TimelineItem, { kind: "thinking" }> }) {
  return (
    <details className="text-sm text-muted-foreground">
      <summary className="cursor-pointer">Thinking</summary>
      <p className="mt-1 border-l-2 border-border pl-3 whitespace-pre-wrap">{item.text}</p>
    </details>
  );
}

export function NoticeItem({ item }: { item: Extract<TimelineItem, { kind: "notice" }> }) {
  return (
    <p
      role={item.tone === "error" ? "alert" : undefined}
      className={`text-center text-xs ${item.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
    >
      {item.text}
    </p>
  );
}
