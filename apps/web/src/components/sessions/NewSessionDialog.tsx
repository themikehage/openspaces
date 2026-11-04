import type { AdapterInfoDto, CreateSessionRequest } from "@openspaces/protocol";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";
import { useNewSessionForm } from "@/hooks/use-new-session-form";

interface Props {
  open: boolean;
  adapters: AdapterInfoDto[];
  projects: string[];
  create: (input: CreateSessionRequest) => Promise<{ id: string }>;
  onClose: () => void;
  onCreated: (id: string) => void;
}

const field = fieldClass;

export function NewSessionDialog({ open, adapters, projects, create, onClose, onCreated }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const form = useNewSessionForm({ adapters, projects, create, onCreated });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="new-session-title"
      className="m-auto w-full max-w-md rounded-2xl bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-xs"
    >
      <form
        className="flex flex-col gap-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit();
        }}
      >
        <h2 id="new-session-title" className="text-base font-semibold">
          New session
        </h2>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Agent
          <select
            className={field}
            value={form.adapterId}
            onChange={(event) => form.setAdapterId(event.target.value)}
          >
            {adapters.map((adapter) => {
              const usable = adapter.probe.available && adapter.probe.supported;
              return (
                <option key={adapter.id} value={adapter.id} disabled={!usable}>
                  {adapter.displayName}
                  {usable
                    ? ` ${adapter.probe.version ?? ""}`
                    : ` (${adapter.probe.reason ?? "unavailable"})`}
                </option>
              );
            })}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Project directory
          <input
            className={`${field} font-mono`}
            list="registered-projects"
            value={form.cwd}
            onChange={(event) => form.setCwd(event.target.value)}
            placeholder="/path/inside/a/registered/project"
            spellCheck={false}
          />
          <datalist id="registered-projects">
            {projects.map((project) => (
              <option key={project} value={project} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Workspace
          <select
            className={field}
            value={form.workspace}
            onChange={(event) => form.setWorkspace(event.target.value as typeof form.workspace)}
          >
            <option value="auto">Automatic (isolated worktree for git projects)</option>
            <option value="worktree">Isolated git worktree</option>
            <option value="in-place">Work in place</option>
          </select>
        </label>

        {form.error && (
          <p role="alert" className="text-sm text-destructive">
            {form.error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={!form.canSubmit}>
            {form.submitting ? "Starting…" : "Start session"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
