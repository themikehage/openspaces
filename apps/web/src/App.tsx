import { Moon, Plus, Sun } from "lucide-react";
import { useState } from "react";
import { NewSessionDialog } from "@/components/sessions/NewSessionDialog";
import { SessionList } from "@/components/sessions/SessionList";
import { SessionView } from "@/components/session/SessionView";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { useHashRoute } from "@/hooks/use-hash-route";
import { useSessions } from "@/hooks/use-sessions";
import { useTheme } from "@/hooks/use-theme";

export function App() {
  const { sessionId, open } = useHashRoute();
  const { sessions, adapters, projects, error, create } = useSessions();
  const { theme, toggle } = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex h-full gap-3 bg-background p-3">
      <aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl bg-card shadow-card">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-base font-semibold">OpenSpaces</span>
          <div className="flex items-center gap-1">
            <IconButton
              icon={theme === "dark" ? Sun : Moon}
              label={theme === "dark" ? "Use light theme" : "Use dark theme"}
              onClick={toggle}
            />
            <Button variant="accent" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </div>
        </div>
        <nav aria-label="Sessions" className="flex-1 overflow-y-auto">
          <SessionList sessions={sessions} activeId={sessionId} error={error} onOpen={open} />
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card shadow-card">
        {sessionId ? (
          <SessionView key={sessionId} sessionId={sessionId} adapters={adapters} onOpen={open} />
        ) : (
          <p className="m-auto text-sm text-muted-foreground">
            Select a session or start a new one.
          </p>
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
