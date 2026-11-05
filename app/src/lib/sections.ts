import { signal } from "@preact/signals";

/** The sections on the picture screen, in order. The side rail links to the ones on the page. */
export const SECTIONS = [
  { id: "sec-frame", label: "Frame" },
  { id: "sec-colours", label: "Colours" },
  { id: "sec-seam", label: "Seam" },
  { id: "sec-duplicate", label: "Duplicate stitch" },
  { id: "sec-result", label: "Result" },
];

export const sectionIndex = signal<{ id: string; label: string }[]>([]);

/** Look at the page and keep the ones that are there. */
export function refreshSections(): void {
  const here = SECTIONS.filter((s) => document.getElementById(s.id));
  if (here.map((s) => s.id).join() !== sectionIndex.value.map((s) => s.id).join()) sectionIndex.value = here;
}

export function scrollToSection(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}
