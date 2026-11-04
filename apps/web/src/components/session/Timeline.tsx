import type { ApprovalDecision } from "@openspaces/core";
import { ApprovalItem } from "@/components/session/ApprovalItem";
import { MessageItem } from "@/components/session/MessageItem";
import { NoticeItem, ThinkingItem } from "@/components/session/MinorItems";
import { ToolItem } from "@/components/session/ToolItem";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import type { TimelineItem } from "@/lib/timeline";

interface Props {
  items: TimelineItem[];
  busy: boolean;
  onDecide: (approvalId: string, decision: ApprovalDecision) => void;
}

export function Timeline({ items, busy, onDecide }: Props) {
  const ref = useStickToBottom(items);
  return (
    <div
      ref={ref}
      role="log"
      aria-live="polite"
      aria-label="Session timeline"
      className="flex flex-1 flex-col gap-3 overflow-y-auto bg-background p-5"
    >
      {items.length === 0 && (
        <p className="m-auto text-sm text-muted-foreground">Send a prompt to begin.</p>
      )}
      {items.map((item) => {
        const key = `${item.kind}-${item.id}`;
        switch (item.kind) {
          case "message":
            return <MessageItem key={key} item={item} />;
          case "thinking":
            return <ThinkingItem key={key} item={item} />;
          case "tool":
            return <ToolItem key={key} item={item} />;
          case "approval":
            return <ApprovalItem key={key} item={item} disabled={busy} onDecide={onDecide} />;
          case "notice":
            return <NoticeItem key={key} item={item} />;
        }
      })}
    </div>
  );
}
