import type { AdapterInfoDto } from "@openspaces/protocol";
import { useEffect, useRef } from "react";
import { useNewSessionForm } from "@/hooks/use-new-session-form";

interface Props {
  open: boolean;
  adapters: AdapterInfoDto[];
  projects: string[];
  create: (input: { adapterId: string; cwd: string }) => Promise<{ id: string }>;
  onClose: () => void;
  onCreated: (id: string) => void;
}

const field =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted";

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
      className="m-auto w-full max-w-md rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/40"
    >
      <form
        className="flex flex-col gap-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit();
        }}
      >
        <h2 id="new-session-title" className="text-lg font-semibold">
          New session
        </h2>

        <label className="flex flex-col gap-1 text-sm">
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

        <label className="flex flex-col gap-1 text-sm">
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

        {form.error && (
          <p role="alert" className="text-sm text-danger">
            {form.error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm hover:bg-sunken"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!form.canSubmit}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
          >
            {form.submitting ? "Starting…" : "Start session"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
