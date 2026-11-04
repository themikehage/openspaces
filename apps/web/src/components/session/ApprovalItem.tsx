import type { ApprovalDecision } from "@openspaces/core";
import { Button } from "@/components/ui/Button";
import { stringifyInput } from "@/lib/format";
import type { TimelineItem } from "@/lib/timeline";

type Approval = Extract<TimelineItem, { kind: "approval" }>;

const DECISION_LABEL: Record<ApprovalDecision, string> = {
  allow_once: "Allowed once",
  allow_session: "Allowed for this session",
  deny: "Denied",
};

interface Props {
  item: Approval;
  disabled: boolean;
  onDecide: (approvalId: string, decision: ApprovalDecision) => void;
}

export function ApprovalItem({ item, disabled, onDecide }: Props) {
  const pending = !item.decision;
  return (
    <section
      aria-label="Approval request"
      className={`rounded-xl p-4 ${pending ? "border border-warning/40 bg-warning/10" : "bg-surface"}`}
    >
      <p className="text-sm font-medium">{item.title}</p>
      {item.details !== undefined && (
        <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-card p-2 font-mono text-xs whitespace-pre-wrap">
          {stringifyInput(item.details)}
        </pre>
      )}
      {pending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.options.map((option) => (
            <Button
              key={option.decision}
              disabled={disabled}
              onClick={() => onDecide(item.id, option.decision)}
              variant={option.decision === "deny" ? "solid" : "accent"}
            >
              {option.label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {item.decision ? DECISION_LABEL[item.decision] : ""}
        </p>
      )}
    </section>
  );
}
