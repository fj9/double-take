import { BODY_ROUNDS, GAUGE, PAIRS } from "../hat";
import type { CropBox } from "./image";

/** The picture is cropped to the shape of the fabric: pairs and rounds are not the same size. */
export const FABRIC_ASPECT = PAIRS / GAUGE.pairs / (BODY_ROUNDS / GAUGE.rounds);

export interface CropSettings {
  /** 1 shows as much of the picture as fits the hat's shape; larger zooms in. */
  zoom: number;
  /** Where the middle of the frame is, 0 (left or top) to 1 (right or bottom). */
  cx: number;
  cy: number;
}

export const DEFAULT_CROP: CropSettings = { zoom: 1, cx: 0.5, cy: 0.5 };

/** The part of a picture to use: always the shape of the hat's fabric (about twice as wide as tall). */
export function cropBox(width: number, height: number, c: CropSettings): CropBox {
  const fullW = Math.min(width, height * FABRIC_ASPECT);
  const w = fullW / Math.max(1, c.zoom);
  const h = w / FABRIC_ASPECT;
  const x = Math.max(0, Math.min(width - w, c.cx * width - w / 2));
  const y = Math.max(0, Math.min(height - h, c.cy * height - h / 2));
  return { x, y, width: w, height: h };
}
