import { readFileSync } from "node:fs";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { applyOrientation, shrinkPixels } from "@doubletake/core";
import type { Pixels } from "@doubletake/core";
import { exifOrientation } from "./exif";

/** Open a JPEG or PNG as pixels, the right way up and no bigger than the app uses. Throws a plain message otherwise. */
export function loadPicture(path: string): Pixels {
  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch {
    throw new Error(`Can't open ${path}. Check the file name.`);
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const d = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
    return shrinkPixels(applyOrientation({ width: d.width, height: d.height, data: d.data }, exifOrientation(buf)));
  }
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const p = PNG.sync.read(buf);
    return shrinkPixels({ width: p.width, height: p.height, data: p.data });
  }
  throw new Error("That isn't a JPEG or PNG picture. Convert it to JPEG or PNG first (WebP and HEIC aren't supported here).");
}
