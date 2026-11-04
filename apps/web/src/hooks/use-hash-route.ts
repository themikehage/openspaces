import { useCallback, useEffect, useState } from "react";

function read(): string | null {
  const match = /^#\/s\/(.+)$/.exec(window.location.hash);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function useHashRoute() {
  const [sessionId, setSessionId] = useState<string | null>(read);

  useEffect(() => {
    const onChange = () => setSessionId(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const open = useCallback((id: string | null) => {
    window.location.hash = id ? `#/s/${encodeURIComponent(id)}` : "#/";
  }, []);

  return { sessionId, open };
}
