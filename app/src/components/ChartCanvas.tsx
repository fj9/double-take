import { useEffect, useRef } from "preact/hooks";
import { draw, hitTest } from "../lib/render";
import type { ChartView } from "../lib/render";

interface Props {
  view: ChartView;
  label: string;
  onCell?: (cell: { round: number; pair: number }) => void;
  /** Scroll position after drawing: "start" shows the right-hand edge (stitch 1), or an x to centre on. */
  scrollTo?: "start" | number;
  onPinch?: (direction: 1 | -1) => void;
}

/** A chart on a canvas inside a horizontally scrolling box. Pinch with two fingers to zoom. */
export function ChartCanvas({ view, label, onCell, scrollTo, onPinch }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef(0);

  useEffect(() => {
    if (canvas.current) draw(canvas.current, view);
    const el = box.current;
    if (el && scrollTo !== undefined) {
      if (scrollTo === "start") el.scrollLeft = el.scrollWidth;
      else el.scrollLeft = Math.max(0, scrollTo - el.clientWidth / 2);
    }
  });

  const dist = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  return (
    <div
      class="chart-scroll"
      ref={box}
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
    </div>
  );
}
