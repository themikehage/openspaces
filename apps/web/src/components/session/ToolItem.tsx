import { stringifyInput } from "@/lib/format";
import type { TimelineItem } from "@/lib/timeline";

type Tool = Extract<TimelineItem, { kind: "tool" }>;

const MARK: Record<Tool["status"], { text: string; className: string }> = {
  running: { text: "running", className: "text-accent" },
  ok: { text: "done", className: "text-ok" },
  error: { text: "failed", className: "text-danger" },
};

export function ToolItem({ item }: { item: Tool }) {
  const mark = MARK[item.status];
  return (
    <details className="rounded-lg border border-line bg-surface">
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
        <span className="font-mono">{item.name}</span>
        <span className={`text-xs ${mark.className}`}>{mark.text}</span>
      </summary>
      <div className="flex flex-col gap-2 border-t border-line p-3">
        <pre className="max-h-48 overflow-auto font-mono text-xs whitespace-pre-wrap">
          {stringifyInput(item.input)}
        </pre>
        {item.output && (
          <pre className="max-h-72 overflow-auto rounded-md bg-sunken p-2 font-mono text-xs whitespace-pre-wrap">
            {item.output}
          </pre>
        )}
      </div>
    </details>
  );
}
