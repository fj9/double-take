import { useEffect, useRef } from "preact/hooks";
import type { Pixels } from "@doubletake/core";
import { DEFAULT_CROP, cropBox } from "../lib/crop";
import type { CropSettings } from "../lib/crop";
import { useWidth } from "../lib/useWidth";

interface Props {
  pixels: Pixels;
  crop: CropSettings;
  onCrop: (c: CropSettings) => void;
  /** False when the picture is being repeated: the whole repeated picture is used, so there is no frame to move. */
  framed: boolean;
}

const MAX_HEIGHT = 320;
const STEP = 0.04;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The picture with the part that will be used outlined. Drag to move the frame, pinch or scroll to zoom, or use the buttons and arrow keys. */
export function FrameEditor({ pixels, crop, onCrop, framed }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const width = useWidth(box);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef({ dist: 0, zoom: 1 });
  const latest = useRef(crop);
  latest.current = crop;

  const scale = Math.max(0.01, Math.min((width || 320) / pixels.width, MAX_HEIGHT / pixels.height));
  const cssW = Math.round(pixels.width * scale);
  const cssH = Math.round(pixels.height * scale);

  const source = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = document.createElement("canvas");
    c.width = pixels.width;
    c.height = pixels.height;
    c.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
    source.current = c;
  }, [pixels]);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    const src = source.current;
    if (!c || !ctx || !src) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.ceil(cssW * dpr);
    c.height = Math.ceil(cssH * dpr);
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(src, 0, 0, cssW, cssH);
    if (!framed) return;
    const b = cropBox(pixels.width, pixels.height, crop);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.drawImage(src, b.x, b.y, b.width, b.height, b.x * scale, b.y * scale, b.width * scale, b.height * scale);
    ctx.strokeStyle = "#f26b5b";
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x * scale, b.y * scale, b.width * scale, b.height * scale);
  }, [pixels, crop, framed, cssW, cssH, scale, width]);

  const set = (c: Partial<CropSettings>) => {
    // Keep the newest value at hand straight away, so several quick moves in a row add up before the screen redraws
    const next = { ...latest.current, ...c };
    latest.current = { zoom: clamp(next.zoom, 1, 4), cx: clamp(next.cx, 0, 1), cy: clamp(next.cy, 0, 1) };
    onCrop(latest.current);
  };
  const dist = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  return (
    <div>
      <div ref={box} style="width:100%;display:flex;justify-content:center">
        <canvas
          ref={canvas}
          tabIndex={framed ? 0 : -1}
          role="img"
          aria-label={framed ? "Your picture with the part that will be used outlined. Drag to move the outline, pinch or use the plus and minus keys to zoom, or use the arrow keys." : "Your picture, repeated across the hat"}
          style={`max-width:100%;border-radius:8px;display:block;touch-action:${framed ? "none" : "auto"};cursor:${framed ? "grab" : "default"}`}
          onPointerDown={(e) => {
            if (!framed) return;
            (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.current.size === 2) pinchStart.current = { dist: dist(), zoom: latest.current.zoom };
          }}
          onPointerMove={(e) => {
            const before = pointers.current.get(e.pointerId);
            if (!framed || !before) return;
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.current.size === 2) {
              if (pinchStart.current.dist > 0) set({ zoom: pinchStart.current.zoom * (dist() / pinchStart.current.dist) });
            } else {
              set({ cx: latest.current.cx + (e.clientX - before.x) / cssW, cy: latest.current.cy + (e.clientY - before.y) / cssH });
            }
          }}
          onPointerUp={(e) => pointers.current.delete(e.pointerId)}
          onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
          onWheel={(e) => {
            if (!framed) return;
            e.preventDefault();
            set({ zoom: latest.current.zoom * Math.exp(-e.deltaY * 0.0015) });
          }}
          onKeyDown={(e) => {
            if (!framed) return;
            const moves: Record<string, Partial<CropSettings>> = {
              ArrowLeft: { cx: crop.cx - STEP },
              ArrowRight: { cx: crop.cx + STEP },
              ArrowUp: { cy: crop.cy - STEP },
              ArrowDown: { cy: crop.cy + STEP },
              "+": { zoom: crop.zoom + 0.2 },
              "=": { zoom: crop.zoom + 0.2 },
              "-": { zoom: crop.zoom - 0.2 },
            };
            const move = moves[e.key];
            if (move) {
              e.preventDefault();
              set(move);
            }
          }}
        />
      </div>
      {framed && (
        <div class="stack" style="margin-top:12px">
          <label class="field" style="margin:0">
            <span class="small muted">Zoom</span>
            <input class="range" type="range" min="1" max="4" step="0.1" value={crop.zoom} onInput={(e) => set({ zoom: Number((e.currentTarget as HTMLInputElement).value) })} />
          </label>
          <div class="row" style="flex-wrap:wrap;gap:8px">
            <span class="small muted">Move the outline</span>
            <div class="seg" role="group" aria-label="Move the outline">
              <button aria-label="Move the outline left" onClick={() => set({ cx: crop.cx - STEP })}>
                ←
              </button>
              <button aria-label="Move the outline up" onClick={() => set({ cy: crop.cy - STEP })}>
                ↑
              </button>
              <button aria-label="Move the outline down" onClick={() => set({ cy: crop.cy + STEP })}>
                ↓
              </button>
              <button aria-label="Move the outline right" onClick={() => set({ cx: crop.cx + STEP })}>
                →
              </button>
            </div>
            <button class="btn small" onClick={() => onCrop(DEFAULT_CROP)}>
              Fit
            </button>
          </div>
          <p class="small muted" style="margin:0">Drag the picture to move the outline, and pinch or scroll to zoom.</p>
        </div>
      )}
    </div>
  );
}
