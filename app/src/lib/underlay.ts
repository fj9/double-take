import type { Pixels } from "@doubletake/core";
import type { CropSettings } from "./crop";
import { DEFAULT_CROP } from "./crop";

/** A picture to trace over, ready to draw. The picture is not part of the chart. */
export interface Underlay {
  canvas: HTMLCanvasElement;
  crop: CropSettings;
  /** 0 to 1. */
  opacity: number;
  visible: boolean;
  /** When zoomed out so the picture repeats, flip every other copy so the edges match. */
  mirror: boolean;
}

/** Stored pictures are kept small: a trace doesn't need more. */
const STORE_SIDE = 1280;

export function pixelsToCanvas(p: Pixels): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = p.width;
  c.height = p.height;
  c.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.width, p.height), 0, 0);
  return c;
}

export function newUnderlay(canvas: HTMLCanvasElement): Underlay {
  return { canvas, crop: DEFAULT_CROP, opacity: 0.4, visible: true, mirror: false };
}

/** A small JPEG of the picture, for keeping on the device. */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const scale = Math.min(1, STORE_SIDE / Math.max(canvas.width, canvas.height));
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(canvas.width * scale));
  small.height = Math.max(1, Math.round(canvas.height * scale));
  small.getContext("2d")?.drawImage(canvas, 0, 0, small.width, small.height);
  return new Promise((resolve, reject) => small.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn’t keep the picture."))), "image/jpeg", 0.85));
}

export async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bitmap.width;
  c.height = bitmap.height;
  c.getContext("2d")?.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return c;
}
