import { useEffect, useRef, useState } from "preact/hooks";
import { draw, drawGutter, geometry, gutterWidth, hitTest } from "../lib/render";
import type { ChartView } from "../lib/render";

interface Props {
  /** The whole round: all 112 pairs, pair 1 at the right. The round numbers are drawn on a separate, sticky canvas. */
  view: ChartView;
  label: string;
  /** The last pair worked in the current round, or null. The strip scrolls to keep it in view. */
  focusPair: number | null;
  /** Changes when the strip should jump to the focus even though the pair hasn't (a new round). */
  focusKey: string | number;
  onCell?: (cell: { round: number; pair: number }) => void;
  onPinch?: (direction: 1 | -1) => void;
}

const PAIRS = 112;
/** Where the marker sits across the visible strip, from the left. Work moves leftwards, so there is more room to the left of it. */
const MARKER_AT = 0.68;

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** One strip for the whole round that follows your place, with a minimap of the 112 pairs and a way back to your place. */
export function StripChart({ view, label, focusPair, focusKey, onCell, onPinch }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const gutter = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef(0);
  const [scroll, setScroll] = useState({ left: 0, width: 0 });
  const mounted = useRef(false);

  const g = geometry(view);
  const gw = gutterWidth(view);
  const centreOf = (pair: number) => g.left + (view.cols.indexOf(pair) + 0.5) * g.cellW;

  const measure = () => {
    const el = box.current;
    if (el) setScroll({ left: el.scrollLeft, width: el.clientWidth });
  };

  useEffect(() => {
    if (canvas.current) draw(canvas.current, view);
    if (gutter.current) drawGutter(gutter.current, view);
  });

  const follow = (behavior: ScrollBehavior) => {
    const el = box.current;
    if (!el) return;
    if (focusPair === null) el.scrollTo({ left: el.scrollWidth, behavior });
    else el.scrollTo({ left: Math.max(0, centreOf(focusPair) - el.clientWidth * MARKER_AT), behavior });
  };

  // Keep the place in view when it moves, a new round starts, or the cells change size
  useEffect(() => {
    follow(mounted.current && !reducedMotion() ? "smooth" : "auto"); // jump on arrival, glide afterwards
    mounted.current = true;
    const t = setTimeout(measure, 350);
    return () => clearTimeout(t);
  }, [focusPair, focusKey, view.cellW]);

  useEffect(() => {
    measure();
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dist = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  // The minimap runs left to right in the strip's own order: pair 112 at the left, pair 1 at the right
  const firstCol = Math.max(0, (scroll.left - g.left) / g.cellW);
  const lastCol = Math.min(PAIRS, (scroll.left + scroll.width - gw - g.left) / g.cellW);
  const markerCol = focusPair === null ? null : view.cols.indexOf(focusPair);
  const away = markerCol !== null && scroll.width > 0 && (markerCol + 0.5 < firstCol || markerCol + 0.5 > lastCol);

  return (
    <div class="strip">
      <button
        type="button"
        class="minimap"
        aria-label="Round overview. Tap to move along the round."
        onClick={(e) => {
          const el = box.current;
          if (!el || e.detail === 0) return; // a key press has no position to go to
          const rect = e.currentTarget.getBoundingClientRect();
          const col = ((e.clientX - rect.left) / rect.width) * PAIRS;
          el.scrollTo({ left: Math.max(0, g.left + col * g.cellW - (el.clientWidth - gw) / 2), behavior: reducedMotion() ? "auto" : "smooth" });
        }}
      >
        <span class="mm-join" style={`left:${((PAIRS - 56) / PAIRS) * 100}%`} aria-hidden="true" />
        <span class="mm-view" style={`left:${(firstCol / PAIRS) * 100}%;width:${Math.max(2, ((lastCol - firstCol) / PAIRS) * 100)}%`} aria-hidden="true" />
        {markerCol !== null && <span class="mm-marker" style={`left:${((markerCol + 0.5) / PAIRS) * 100}%`} aria-hidden="true" />}
      </button>
      <div
        class="chart-scroll strip-scroll"
        ref={box}
        tabIndex={0}
        role="region"
        aria-label={`${label.split(/[.:]/)[0]}, scrolls sideways`}
        onScroll={measure}
        onPointerDown={(e) => {
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2) pinchStart.current = dist();
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 2 && onPinch && pinchStart.current > 0) {
            const ratio = dist() / pinchStart.current;
            if (ratio > 1.3) {
              onPinch(1);
              pinchStart.current = dist();
            } else if (ratio < 0.77) {
              onPinch(-1);
              pinchStart.current = dist();
            }
          }
        }}
        onPointerUp={(e) => pointers.current.delete(e.pointerId)}
        onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
      >
        <canvas
          ref={canvas}
          role="img"
          aria-label={label}
          onClick={(e) => {
            if (!onCell || !canvas.current) return;
            const rect = canvas.current.getBoundingClientRect();
            const hit = hitTest(view, e.clientX - rect.left, e.clientY - rect.top);
            if (hit) onCell(hit);
          }}
        />
        <canvas ref={gutter} class="gutter" aria-hidden="true" />
      </div>
      {away && (
        <button type="button" class="btn small back-to-place" onClick={() => follow(reducedMotion() ? "auto" : "smooth")}>
          Back to my place
        </button>
      )}
    </div>
  );
}
