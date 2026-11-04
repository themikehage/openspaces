import { useEffect, useRef } from "react";

const THRESHOLD_PX = 80;

export function useStickToBottom(dependency: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const stuck = useRef(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onScroll = () => {
      stuck.current =
        element.scrollHeight - element.scrollTop - element.clientHeight < THRESHOLD_PX;
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (element && stuck.current) element.scrollTop = element.scrollHeight;
  }, [dependency]);

  return ref;
}
