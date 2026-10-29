/** Does the slow picture work off the main thread, so the screen stays responsive. */
import { extractPalette, makeRoles } from "@doubletake/core";
import type { CropBox, Pixels } from "@doubletake/core";

type Request =
  | { id: number; op: "load"; width: number; height: number; buffer: ArrayBuffer }
  | { id: number; op: "palette"; crop?: CropBox }
  | { id: number; op: "roles"; colours: number; seam: "fade" | "accept"; minPatch: number; crop?: CropBox };

const ctx = self as unknown as { onmessage: (e: MessageEvent<Request>) => void; postMessage: (m: unknown, t?: Transferable[]) => void };
let picture: Pixels | null = null;

ctx.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.op === "load") {
      picture = { width: m.width, height: m.height, data: new Uint8ClampedArray(m.buffer) };
      ctx.postMessage({ id: m.id, ok: true });
      return;
    }
    if (!picture) throw new Error("No picture loaded.");
    if (m.op === "palette") {
      ctx.postMessage({ id: m.id, ok: true, result: extractPalette(picture, { cap: 6, ...(m.crop ? { crop: m.crop } : {}) }) });
    } else {
      const r = makeRoles(picture, { colours: m.colours, seam: m.seam, minPatch: m.minPatch, ...(m.crop ? { crop: m.crop } : {}) });
      ctx.postMessage({ id: m.id, ok: true, result: r }, [r.grid.data.buffer]);
    }
  } catch (err) {
    ctx.postMessage({ id: m.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
