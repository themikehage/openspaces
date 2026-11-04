import { useState } from "react";
import { NewSessionDialog } from "@/components/sessions/NewSessionDialog";
import { SessionList } from "@/components/sessions/SessionList";
import { SessionView } from "@/components/session/SessionView";
import { useHashRoute } from "@/hooks/use-hash-route";
import { useSessions } from "@/hooks/use-sessions";

export function App() {
  const { sessionId, open } = useHashRoute();
  const { sessions, adapters, projects, error, create } = useSessions();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex h-full">
      <aside className="flex w-72 shrink-0 flex-col border-r border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-base font-semibold">OpenSpaces</span>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink"
          >
            New
          </button>
        </div>
        <nav aria-label="Sessions" className="flex-1 overflow-y-auto">
          <SessionList sessions={sessions} activeId={sessionId} error={error} onOpen={open} />
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {sessionId ? (
          <SessionView key={sessionId} sessionId={sessionId} adapters={adapters} />
        ) : (
          <p className="m-auto text-sm text-muted">Select a session or start a new one.</p>
        )}
      </main>

      <NewSessionDialog
        open={dialogOpen}
        adapters={adapters}
        projects={projects}
        create={create}
        onClose={() => setDialogOpen(false)}
        onCreated={(id) => {
          setDialogOpen(false);
          open(id);
        }}
      />
    </div>
  );
}
