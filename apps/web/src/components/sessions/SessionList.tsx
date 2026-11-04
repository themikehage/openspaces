import type { SessionDto } from "@openspaces/protocol";
import { StatusBadge } from "@/components/sessions/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { shortPath } from "@/lib/format";

interface Props {
  sessions: SessionDto[];
  activeId: string | null;
  error: string | null;
  onOpen: (id: string) => void;
}

export function SessionList({ sessions, activeId, error, onOpen }: Props) {
  if (error)
    return (
      <p className="p-4 text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  if (sessions.length === 0)
    return <p className="p-4 text-sm text-muted-foreground">No sessions yet.</p>;
  return (
    <ul className="flex flex-col gap-1 p-2">
      {sessions.map((session) => (
        <li key={session.id}>
          <button
            type="button"
            onClick={() => onOpen(session.id)}
            aria-current={session.id === activeId ? "page" : undefined}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-hover ${
              session.id === activeId ? "bg-surface-hover" : ""
            }`}
          >
            <Avatar name={session.adapterId} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{session.adapterId}</span>
                <StatusBadge state={session.state} />
              </span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {shortPath(session.cwd)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
