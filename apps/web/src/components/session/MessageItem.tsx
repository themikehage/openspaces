import type { TimelineItem } from "@/lib/timeline";

type Message = Extract<TimelineItem, { kind: "message" }>;

export function MessageItem({ item }: { item: Message }) {
  const user = item.role === "user";
  return (
    <div className={`flex ${user ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          user ? "bg-accent text-accent-ink" : "border border-line bg-surface"
        }`}
      >
        {item.text}
        {!item.complete && (
          <span aria-hidden="true" className="ml-0.5 animate-pulse">
            ▍
          </span>
        )}
      </p>
    </div>
  );
}
