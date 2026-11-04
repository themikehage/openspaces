import type { SessionDto } from "@openspaces/protocol";
import { StatusBadge } from "@/components/sessions/StatusBadge";
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
      <p className="p-3 text-sm text-danger" role="alert">
        {error}
      </p>
    );
  if (sessions.length === 0) return <p className="p-3 text-sm text-muted">No sessions yet.</p>;
  return (
    <ul className="flex flex-col gap-1 p-2">
      {sessions.map((session) => (
        <li key={session.id}>
          <button
            type="button"
            onClick={() => onOpen(session.id)}
            aria-current={session.id === activeId ? "page" : undefined}
            className={`flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left hover:bg-sunken ${
              session.id === activeId ? "bg-sunken" : ""
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{session.adapterId}</span>
              <StatusBadge state={session.state} />
            </span>
            <span className="truncate font-mono text-xs text-muted">{shortPath(session.cwd)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
