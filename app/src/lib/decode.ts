import { shrinkPixels } from "@doubletake/core";
import type { Pixels } from "@doubletake/core";

/** The longest side the browser will draw before our own shrinking takes over, so huge photos fit in memory. */
const BROWSER_LIMIT = 4096;

/** Open a picture file as pixels. The picture stays on this device. Throws a message for the knitter if it can't. */
export async function decodePicture(file: File): Promise<Pixels> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file isn’t a picture this browser can open. Try a JPEG or PNG.");
  }
  let w = bitmap.width;
  let h = bitmap.height;
  const longest = Math.max(w, h);
  if (longest > BROWSER_LIMIT) {
    w = Math.round((w * BROWSER_LIMIT) / longest);
    h = Math.round((h * BROWSER_LIMIT) / longest);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser can’t read pictures. Try another browser.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const data = ctx.getImageData(0, 0, w, h);
  return shrinkPixels({ width: w, height: h, data: data.data });
}
