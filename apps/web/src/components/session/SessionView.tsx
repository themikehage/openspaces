import type { AdapterInfoDto } from "@openspaces/protocol";
import { PromptBox } from "@/components/session/PromptBox";
import { SessionHeader } from "@/components/session/SessionHeader";
import { Timeline } from "@/components/session/Timeline";
import { useSession } from "@/hooks/use-session";

interface Props {
  sessionId: string;
  adapters: AdapterInfoDto[];
  onOpen: (id: string) => void;
}

export function SessionView({ sessionId, adapters, onOpen }: Props) {
  const view = useSession(sessionId);
  const { session } = view;

  if (!session) {
    return (
      <p
        className="m-auto text-sm text-muted-foreground"
        role={view.actionError ? "alert" : "status"}
      >
        {view.actionError ?? "Loading session…"}
      </p>
    );
  }

  const adapter = adapters.find((candidate) => candidate.id === session.adapterId);
  const finished = session.state === "ended" || session.state === "failed";
  const running = session.state === "running" || session.state === "awaiting_approval";

  return (
    <div className="flex h-full flex-col">
      <SessionHeader
        session={session}
        adapter={adapter}
        status={view.status}
        usage={view.timeline.usage}
        canClose={!finished}
        canResume={
          finished && Boolean(session.externalSessionId) && (adapter?.capabilities.resume ?? false)
        }
        onClose={() => void view.close()}
        onResume={() =>
          void view.resume().then((id) => {
            if (id) onOpen(id);
          })
        }
      />
      <Timeline
        items={view.timeline.items}
        busy={view.busy}
        onDecide={(approvalId, decision) => void view.approve(approvalId, decision)}
      />
      {view.actionError && (
        <p role="alert" className="px-4 pb-2 text-sm text-destructive">
          {view.actionError}
        </p>
      )}
      <PromptBox
        disabled={finished || running || view.busy}
        running={running}
        canInterrupt={adapter?.capabilities.interrupt ?? false}
        onSend={view.sendPrompt}
        onInterrupt={() => void view.interrupt()}
      />
    </div>
  );
}
