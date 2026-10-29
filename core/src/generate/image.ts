/**
 * Image handling that doesn't depend on the browser canvas or any Node library, so the same pixels always give
 * the same chart. The caller (the app or the skill's command line) only decodes a file into pixels.
 */

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, 4 bytes a pixel, row by row from the top left. */
  data: Uint8ClampedArray | Uint8Array;
}

/** Floating point RGB, 3 numbers a pixel (0 to 255). */
export interface RgbImage {
  width: number;
  height: number;
  data: Float64Array;
}

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Pixels as plain RGB. Transparent areas are laid over white. */
export function toRgb(img: Pixels): RgbImage {
  const { width, height, data } = img;
  const out = new Float64Array(width * height * 3);
  for (let i = 0, j = 0; i < width * height; i++, j += 4) {
    const a = (data[j + 3] ?? 255) / 255;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = (data[j + c] as number) * a + 255 * (1 - a);
  }
  return { width, height, data: out };
}

export function crop(img: RgbImage, box: CropBox): RgbImage {
  const x0 = Math.max(0, Math.min(img.width - 1, Math.floor(box.x)));
  const y0 = Math.max(0, Math.min(img.height - 1, Math.floor(box.y)));
  const w = Math.max(1, Math.min(img.width - x0, Math.floor(box.width)));
  const h = Math.max(1, Math.min(img.height - y0, Math.floor(box.height)));
  const out = new Float64Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const src = ((y0 + y) * img.width + x0) * 3;
    out.set(img.data.subarray(src, src + w * 3), y * w * 3);
  }
  return { width: w, height: h, data: out };
}

/** Crop from the middle to a width-to-height ratio. */
export function cropToAspect(img: RgbImage, aspect: number): RgbImage {
  const { width: w, height: h } = img;
  if (w / h > aspect) {
    const nw = Math.max(1, Math.floor(h * aspect));
    return crop(img, { x: Math.floor((w - nw) / 2), y: 0, width: nw, height: h });
  }
  const nh = Math.max(1, Math.floor(w / aspect));
  return crop(img, { x: 0, y: Math.floor((h - nh) / 2), width: w, height: nh });
}

/**
 * Make the picture tile left to right: the last `feather` of the width is faded into the first, and removed.
 * The result is narrower, and its right edge continues into its left edge.
 */
export function seamless(img: RgbImage, feather = 0.15): RgbImage {
  const n = img.width;
  const s = Math.max(2, Math.floor(n * feather));
  const w = n - s;
  const out = new Float64Array(w * img.height * 3);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        const head = img.data[(y * n + x) * 3 + c] as number;
        if (x < s) {
          const t = x / s;
          const tail = img.data[(y * n + (n - s + x)) * 3 + c] as number;
          out[(y * w + x) * 3 + c] = t * head + (1 - t) * tail;
        } else out[(y * w + x) * 3 + c] = head;
      }
    }
  }
  return { width: w, height: img.height, data: out };
}

const lanczos3 = (x: number) => {
  if (x === 0) return 1;
  if (x <= -3 || x >= 3) return 0;
  const px = Math.PI * x;
  return (3 * Math.sin(px) * Math.sin(px / 3)) / (px * px);
};

/** Weights for resizing one axis from `from` samples to `to` samples with a Lanczos filter (wider when shrinking, so it smooths). */
function axisWeights(from: number, to: number) {
  const scale = from / to;
  const filterScale = Math.max(1, scale);
  const support = 3 * filterScale;
  const starts = new Int32Array(to);
  const weights: Float64Array[] = [];
  for (let i = 0; i < to; i++) {
    const centre = (i + 0.5) * scale;
    const lo = Math.max(0, Math.floor(centre - support + 0.5));
    const hi = Math.min(from, Math.floor(centre + support + 0.5));
    const w = new Float64Array(Math.max(1, hi - lo));
    let total = 0;
    for (let x = lo; x < hi; x++) {
      const v = lanczos3((x - centre + 0.5) / filterScale);
      w[x - lo] = v;
      total += v;
    }
    if (total !== 0) for (let k = 0; k < w.length; k++) w[k] = (w[k] as number) / total;
    starts[i] = lo;
    weights.push(w);
  }
  return { starts, weights };
}

export function resizeLanczos(img: RgbImage, width: number, height: number): RgbImage {
  const hx = axisWeights(img.width, width);
  const mid = new Float64Array(width * img.height * 3);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < width; x++) {
      const w = hx.weights[x] as Float64Array;
      const s = hx.starts[x] as number;
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let k = 0; k < w.length; k++) acc += (w[k] as number) * (img.data[(y * img.width + s + k) * 3 + c] as number);
        mid[(y * width + x) * 3 + c] = acc;
      }
    }
  }
  const vy = axisWeights(img.height, height);
  const out = new Float64Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const w = vy.weights[y] as Float64Array;
    const s = vy.starts[y] as number;
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let k = 0; k < w.length; k++) acc += (w[k] as number) * (mid[((s + k) * width + x) * 3 + c] as number);
        out[(y * width + x) * 3 + c] = Math.min(255, Math.max(0, acc));
      }
    }
  }
  return { width, height, data: out };
}

/** Shrink so the longer side is at most `size`, by averaging (a box filter). Never enlarges. */
export function thumbnail(img: RgbImage, size: number): RgbImage {
  const scale = Math.max(img.width, img.height) / size;
  if (scale <= 1) return img;
  const w = Math.max(1, Math.round(img.width / scale));
  const h = Math.max(1, Math.round(img.height / scale));
  const out = new Float64Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * img.height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * img.width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / w));
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        let n = 0;
        for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++, n++) acc += img.data[(yy * img.width + xx) * 3 + c] as number;
        out[(y * w + x) * 3 + c] = acc / n;
      }
    }
  }
  return { width: w, height: h, data: out };
}

/** Median of each 3 × 3 neighbourhood, per channel: removes single-pixel speckle. */
export function median3(img: RgbImage): RgbImage {
  const { width: w, height: h } = img;
  const out = new Float64Array(img.data.length);
  const win = new Array<number>(9);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const yy = Math.min(h - 1, Math.max(0, y + dy));
            const xx = Math.min(w - 1, Math.max(0, x + dx));
            win[n++] = img.data[(yy * w + xx) * 3 + c] as number;
          }
        }
        win.sort((a, b) => a - b);
        out[(y * w + x) * 3 + c] = win[4] as number;
      }
    }
  }
  return { width: w, height: h, data: out };
}

/** Gaussian blur with standard deviation `sigma` pixels. */
export function gaussianBlur(img: RgbImage, sigma: number): RgbImage {
  if (sigma <= 0) return img;
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float64Array(2 * r + 1);
  let total = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + r] = v;
    total += v;
  }
  for (let i = 0; i < k.length; i++) k[i] = (k[i] as number) / total;
  const { width: w, height: h } = img;
  const mid = new Float64Array(img.data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let i = -r; i <= r; i++) acc += (k[i + r] as number) * (img.data[(y * w + Math.min(w - 1, Math.max(0, x + i))) * 3 + c] as number);
        mid[(y * w + x) * 3 + c] = acc;
      }
    }
  }
  const out = new Float64Array(img.data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        for (let i = -r; i <= r; i++) acc += (k[i + r] as number) * (mid[(Math.min(h - 1, Math.max(0, y + i)) * w + x) * 3 + c] as number);
        out[(y * w + x) * 3 + c] = acc;
      }
    }
  }
  return { width: w, height: h, data: out };
}

/**
 * Shrink a picture so its longer side is at most `maxSide`, by averaging. Big photos are shrunk first so they
 * need less memory; the app and the skill both do this, so they start from the same pixels.
 */
export function shrinkPixels(img: Pixels, maxSide = 2048): Pixels {
  const scale = Math.max(img.width, img.height) / maxSide;
  if (scale <= 1) return img;
  const w = Math.max(1, Math.round(img.width / scale));
  const h = Math.max(1, Math.round(img.height / scale));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * img.height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * img.width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / w));
      const acc = [0, 0, 0, 0];
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++, n++) {
          const i = (yy * img.width + xx) * 4;
          for (let c = 0; c < 4; c++) acc[c] = (acc[c] as number) + (img.data[i + c] as number);
        }
      }
      const o = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out[o + c] = Math.round((acc[c] as number) / n);
    }
  }
  return { width: w, height: h, data: out };
}

/**
 * Turn a picture the right way up, given its EXIF orientation (1 to 8). Phone photos are often stored sideways
 * with a note saying how to turn them. Browsers do this themselves; the command line needs to.
 */
export function applyOrientation(img: Pixels, orientation: number): Pixels {
  if (orientation < 2 || orientation > 8) return img;
  const swap = orientation >= 5;
  const w = swap ? img.height : img.width;
  const h = swap ? img.width : img.height;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      let nx: number;
      let ny: number;
      switch (orientation) {
        case 2: nx = img.width - 1 - x; ny = y; break;
        case 3: nx = img.width - 1 - x; ny = img.height - 1 - y; break;
        case 4: nx = x; ny = img.height - 1 - y; break;
        case 5: nx = y; ny = x; break;
        case 6: nx = img.height - 1 - y; ny = x; break;
        case 7: nx = img.height - 1 - y; ny = img.width - 1 - x; break;
        default: nx = y; ny = img.width - 1 - x; break; // 8
      }
      const s = (y * img.width + x) * 4;
      const d = (ny * w + nx) * 4;
      for (let c = 0; c < 4; c++) out[d + c] = img.data[s + c] as number;
    }
  }
  return { width: w, height: h, data: out };
}
