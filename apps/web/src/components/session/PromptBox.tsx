import { useState, type KeyboardEvent } from "react";

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
      className="flex items-end gap-2 border-t border-line bg-surface p-3"
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
        className="min-h-12 flex-1 resize-y rounded-md border border-line bg-bg px-3 py-2 text-sm disabled:opacity-60"
      />
      {running && canInterrupt && (
        <button
          type="button"
          onClick={onInterrupt}
          className="rounded-md border border-line px-3 py-2 text-sm hover:bg-sunken"
        >
          Interrupt
        </button>
      )}
      <button
        type="submit"
        disabled={disabled || text.trim() === ""}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        Send
      </button>
    </form>
  );
}
