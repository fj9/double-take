import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";

/** A small "?" that opens a short explanation. Tap to open, tap again or press Escape to close. Not hover. */
export function Hint({ label, open: initial = false, children }: { label: string; open?: boolean; children: ComponentChildren }) {
  const [open, setOpen] = useState(initial);
  const button = useRef<HTMLButtonElement>(null);
  const isOpen = useRef(open);
  isOpen.current = open;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen.current) {
        setOpen(false);
        button.current?.focus();
      }
    };
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, []);
  return (
    <span class="hint-wrap">
      <button ref={button} class="hint" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}>
        <span class="q" aria-hidden="true">
          ?
        </span>
      </button>
      {open && <span class="hint-body small">{children}</span>}
    </span>
  );
}
