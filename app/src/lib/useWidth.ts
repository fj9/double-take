import { useEffect, useState } from "preact/hooks";

/** The current width of an element, kept up to date as it resizes. */
export function useWidth(ref: { current: HTMLElement | null }): number {
  const [w, setW] = useState(360);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(200, Math.floor(el.clientWidth)));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}
