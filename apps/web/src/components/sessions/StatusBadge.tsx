import type { SessionDto } from "@openspaces/protocol";

const STYLES: Record<SessionDto["state"], string> = {
  created: "bg-sunken text-muted",
  starting: "bg-sunken text-muted",
  idle: "bg-sunken text-ok",
  running: "bg-accent text-accent-ink",
  awaiting_approval: "bg-warn text-accent-ink",
  ended: "bg-sunken text-muted",
  failed: "bg-danger text-accent-ink",
};

export function StatusBadge({ state }: { state: SessionDto["state"] }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[state]}`}>
      {state.replace("_", " ")}
    </span>
  );
}
