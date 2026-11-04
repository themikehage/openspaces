import type { ApprovalDecision } from "@openspaces/core";
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
      className={`rounded-lg border p-3 ${pending ? "border-warn bg-surface" : "border-line bg-sunken"}`}
    >
      <p className="text-sm font-medium">{item.title}</p>
      {item.details !== undefined && (
        <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-sunken p-2 font-mono text-xs whitespace-pre-wrap">
          {stringifyInput(item.details)}
        </pre>
      )}
      {pending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.options.map((option) => (
            <button
              key={option.decision}
              type="button"
              disabled={disabled}
              onClick={() => onDecide(item.id, option.decision)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                option.decision === "deny"
                  ? "border border-line hover:bg-sunken"
                  : "bg-accent text-accent-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">
          {item.decision ? DECISION_LABEL[item.decision] : ""}
        </p>
      )}
    </section>
  );
}
