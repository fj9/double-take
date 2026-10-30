import { signal } from "@preact/signals";

export type Theme = "system" | "light" | "dark";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`doubletake:${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(`doubletake:${key}`, JSON.stringify(value));
  } catch {
    /* storage can be blocked; the setting just won't be remembered */
  }
}

export const theme = signal<Theme>(load("theme", "system"));
export const highContrast = signal<boolean>(load("highContrast", false));
export const keepAwake = signal<boolean>(load("keepAwake", true));
/** Duplicate stitch dots on the round view. Off by default: the embroidery is done after blocking. */
export const showDuplicate = signal<boolean>(load("showDuplicate", false));
export type Marks = "none" | "letters";
/** Whether each cell shows its yarn letter. Decrease marks are always drawn, whatever this says. */
export const marks = signal<Marks>(load("marks", "letters"));
/** Whether the round view shows the colour blocks and the Next block button. */
export const colourBlocks = signal<boolean>(load("colourBlocks", true));
/** The colour-blocks explanation opens by itself until it has been seen once. */
export const blocksHelpSeen = signal<boolean>(load("blocksHelpSeen", false));
/** Cell width in CSS pixels in the round view. */
export const zoom = signal<number>(load("zoom", 14));

/** Cell width in CSS pixels in the drawing editor. */
export const editorZoom = signal<number>(load("editorZoom", 12));

export const ZOOM_LEVELS = [8, 10, 12, 14, 18, 24, 32, 44];

export function setTheme(value: Theme): void {
  theme.value = value;
  save("theme", value);
  applyTheme();
}
export function setHighContrast(value: boolean): void {
  highContrast.value = value;
  save("highContrast", value);
  document.documentElement.classList.toggle("hc", value);
}
export function setKeepAwake(value: boolean): void {
  keepAwake.value = value;
  save("keepAwake", value);
}
export function setShowDuplicate(value: boolean): void {
  showDuplicate.value = value;
  save("showDuplicate", value);
}
export function setMarks(value: Marks): void {
  marks.value = value;
  save("marks", value);
}
export function setColourBlocks(value: boolean): void {
  colourBlocks.value = value;
  save("colourBlocks", value);
}
export function setBlocksHelpSeen(): void {
  blocksHelpSeen.value = true;
  save("blocksHelpSeen", true);
}
export function setZoom(value: number): void {
  const nearest = ZOOM_LEVELS.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
  zoom.value = nearest;
  save("zoom", nearest);
}
export function zoomBy(direction: 1 | -1): void {
  const i = Math.max(0, ZOOM_LEVELS.indexOf(zoom.value));
  const next = ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, i + direction))] as number;
  setZoom(next);
}

export function applyTheme(): void {
  const root = document.documentElement;
  if (theme.value === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme.value);
  root.classList.toggle("hc", highContrast.value);
}

/** True when the page is currently showing dark colours. */
export function isDark(): boolean {
  const t = document.documentElement.getAttribute("data-theme");
  if (t) return t === "dark";
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export function editorZoomBy(direction: 1 | -1): void {
  const i = Math.max(0, ZOOM_LEVELS.indexOf(editorZoom.value));
  const next = ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, i + direction))] as number;
  editorZoom.value = next;
  save("editorZoom", next);
}
