import type { AdapterInfoDto } from "@openspaces/protocol";
import { useEffect, useMemo, useState } from "react";

interface Params {
  adapters: AdapterInfoDto[];
  projects: string[];
  create: (input: { adapterId: string; cwd: string }) => Promise<{ id: string }>;
  onCreated: (id: string) => void;
}

export function useNewSessionForm({ adapters, projects, create, onCreated }: Params) {
  const usable = useMemo(
    () => adapters.filter((adapter) => adapter.probe.available && adapter.probe.supported),
    [adapters],
  );
  const [adapterId, setAdapterId] = useState("");
  const [cwd, setCwd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!adapterId && usable[0]) setAdapterId(usable[0].id);
  }, [usable, adapterId]);

  useEffect(() => {
    if (!cwd && projects[0]) setCwd(projects[0]);
  }, [projects, cwd]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const session = await create({ adapterId, cwd });
      onCreated(session.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the session");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    adapterId,
    setAdapterId,
    cwd,
    setCwd,
    error,
    submitting,
    submit,
    canSubmit: Boolean(adapterId && cwd) && !submitting,
  };
}
