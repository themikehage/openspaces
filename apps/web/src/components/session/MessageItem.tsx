import type { TimelineItem } from "@/lib/timeline";

type Message = Extract<TimelineItem, { kind: "message" }>;

export function MessageItem({ item }: { item: Message }) {
  const user = item.role === "user";
  return (
    <div className={`flex ${user ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] rounded-bubble px-4 py-2.5 text-sm leading-relaxed shadow-card whitespace-pre-wrap break-words ${
          user ? "rounded-tr-bubble-tail bg-bubble-out" : "rounded-tl-bubble-tail bg-bubble-in"
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
