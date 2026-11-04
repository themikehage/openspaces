import type { SessionDto } from "@openspaces/protocol";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";

const VARIANTS: Record<SessionDto["state"], BadgeVariant> = {
  created: "secondary",
  starting: "secondary",
  idle: "success",
  running: "primary",
  awaiting_approval: "warning",
  ended: "secondary",
  failed: "destructive",
};

export function StatusBadge({ state }: { state: SessionDto["state"] }) {
  return <Badge variant={VARIANTS[state]}>{state.replace("_", " ")}</Badge>;
}
