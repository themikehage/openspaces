import type { StreamStatus } from "@openspaces/api-client";
import type { AdapterInfoDto, SessionDto } from "@openspaces/protocol";
import { StatusBadge } from "@/components/sessions/StatusBadge";
import { formatCost } from "@/lib/format";
import type { Usage } from "@/lib/timeline";

interface Props {
  session: SessionDto;
  adapter: AdapterInfoDto | undefined;
  status: StreamStatus;
  usage: Usage;
  canClose: boolean;
  onClose: () => void;
}

export function SessionHeader({ session, adapter, status, usage, canClose, onClose }: Props) {
  const tokens = usage.inputTokens + usage.outputTokens;
  const unattended = adapter !== undefined && !adapter.capabilities.approvals;
  return (
    <header className="flex flex-col gap-2 border-b border-line bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold">{adapter?.displayName ?? session.adapterId}</h1>
          <p className="truncate font-mono text-xs text-muted" title={session.cwd}>
            {session.cwd}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted" aria-live="polite">
            {status === "reconnecting" ? "Reconnecting…" : ""}
            {tokens > 0 ? `${tokens.toLocaleString()} tokens ${formatCost(usage.costUsd)}` : ""}
          </span>
          <StatusBadge state={session.state} />
          {canClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-sunken"
            >
              End
            </button>
          )}
        </div>
      </div>
      {unattended && (
        <p role="note" className="rounded-md bg-sunken px-3 py-2 text-xs text-warn">
          This agent cannot ask for approvals. It runs unattended with its own permissions.
        </p>
      )}
    </header>
  );
}
