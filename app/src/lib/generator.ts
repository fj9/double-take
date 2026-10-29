import type { CropBox, PaletteCheck, Pixels, RoleResult } from "@doubletake/core";

/** Talks to the picture worker. One picture at a time. */
export class Generator {
  private worker = new Worker(new URL("../workers/generate.worker.ts", import.meta.url), { type: "module" });
  private next = 1;
  private waiting = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor() {
    this.worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const w = this.waiting.get(e.data.id);
      if (!w) return;
      this.waiting.delete(e.data.id);
      if (e.data.ok) w.resolve(e.data.result);
      else w.reject(new Error(e.data.error ?? "Something went wrong with the picture."));
    };
    this.worker.onerror = () => {
      for (const w of this.waiting.values()) w.reject(new Error("Something went wrong with the picture."));
      this.waiting.clear();
    };
  }

  private call<T>(message: Record<string, unknown>, transfer: Transferable[] = []): Promise<T> {
    const id = this.next++;
    return new Promise<T>((resolve, reject) => {
      this.waiting.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ id, ...message }, transfer);
    });
  }

  load(p: Pixels): Promise<void> {
    const copy = new Uint8ClampedArray(p.data); // the worker keeps its own copy; the screen keeps the original
    return this.call({ op: "load", width: p.width, height: p.height, buffer: copy.buffer }, [copy.buffer]);
  }
  palette(crop?: CropBox): Promise<PaletteCheck> {
    return this.call({ op: "palette", crop });
  }
  roles(opts: { colours: number; seam: "fade" | "accept"; minPatch: number; crop?: CropBox }): Promise<RoleResult> {
    return this.call({ op: "roles", ...opts });
  }
  stop(): void {
    this.worker.terminate();
    this.waiting.clear();
  }
}
