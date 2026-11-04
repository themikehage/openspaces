import { SendHorizontal, Square } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { fieldClass } from "@/components/ui/Field";

interface Props {
  disabled: boolean;
  running: boolean;
  canInterrupt: boolean;
  onSend: (text: string) => Promise<void>;
  onInterrupt: () => void;
}

export function PromptBox({ disabled, running, canInterrupt, onSend, onInterrupt }: Props) {
  const [text, setText] = useState("");

  const send = async () => {
    const value = text.trim();
    if (!value || disabled) return;
    setText("");
    await onSend(value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <form
      className="flex items-end gap-2 bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <label className="sr-only" htmlFor="prompt">
        Prompt
      </label>
      <textarea
        id="prompt"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        rows={2}
        placeholder={running ? "The agent is working…" : "Ask the agent to do something"}
        disabled={disabled}
        className={`${fieldClass} min-h-12 flex-1 resize-y rounded-xl`}
      />
      {running && canInterrupt && (
        <Button onClick={onInterrupt} className="py-3">
          <Square className="h-3.5 w-3.5" />
          Interrupt
        </Button>
      )}
      <Button
        type="submit"
        variant="accent"
        disabled={disabled || text.trim() === ""}
        className="py-3"
      >
        <SendHorizontal className="h-3.5 w-3.5" />
        Send
      </Button>
    </form>
  );
}
