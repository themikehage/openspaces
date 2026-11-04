import type { StreamStatus } from "@openspaces/api-client";
import type { AdapterInfoDto, SessionDto } from "@openspaces/protocol";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/sessions/StatusBadge";
import { formatCost } from "@/lib/format";
import type { Usage } from "@/lib/timeline";

interface Props {
  session: SessionDto;
  adapter: AdapterInfoDto | undefined;
  status: StreamStatus;
  usage: Usage;
  canClose: boolean;
  canResume: boolean;
  onClose: () => void;
  onResume: () => void;
}

export function SessionHeader({
  session,
  adapter,
  status,
  usage,
  canClose,
  canResume,
  onClose,
  onResume,
}: Props) {
  const tokens = usage.inputTokens + usage.outputTokens;
  const unattended = adapter !== undefined && !adapter.capabilities.approvals;
  return (
    <header className="flex flex-col gap-3 bg-card px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={adapter?.displayName ?? session.adapterId} />
          <div className="min-w-0">
            <h1 className="text-base font-semibold">{adapter?.displayName ?? session.adapterId}</h1>
            <p className="truncate font-mono text-xs text-muted-foreground" title={session.cwd}>
              {session.cwd}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {status === "reconnecting" ? "Reconnecting…" : ""}
            {tokens > 0 ? `${tokens.toLocaleString()} tokens ${formatCost(usage.costUsd)}` : ""}
          </span>
          <StatusBadge state={session.state} />
          {session.workspace === "worktree" && <Badge>worktree</Badge>}
          {canResume && (
            <Button variant="accent" onClick={onResume}>
              Resume
            </Button>
          )}
          {canClose && <Button onClick={onClose}>End</Button>}
        </div>
      </div>
      {unattended && (
        <p role="note" className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-strong">
          This agent cannot ask for approvals. It runs unattended with its own permissions.
        </p>
      )}
    </header>
  );
}
