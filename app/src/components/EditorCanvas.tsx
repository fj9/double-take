import { useEffect, useRef } from "preact/hooks";
import { draw, geometry } from "../lib/render";
import type { ChartView } from "../lib/render";

interface Cell {
  round: number;
  pair: number;
}

interface Props {
  view: ChartView;
  label: string;
  /** In draw mode a finger paints; in move mode it scrolls. */
  mode: "draw" | "move";
  onStrokeStart: (cell: Cell) => void;
  /** Called for each new cell along a stroke, including the cells between fast pointer moves. */
  onStrokeCell: (cell: Cell) => void;
  onStrokeEnd: () => void;
}

/** The drawing grid: pointer painting on a canvas inside a box that scrolls both ways. */
export function EditorCanvas({ view, label, mode, onStrokeStart, onStrokeCell, onStrokeEnd }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const down = useRef(false);
  const last = useRef<{ c: number; r: number } | null>(null);

  useEffect(() => {
    if (canvas.current) draw(canvas.current, view);
  });

  const index = (e: PointerEvent) => {
    const el = canvas.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const g = geometry(view);
    const c = Math.floor((e.clientX - rect.left - g.left) / g.cellW);
    const r = Math.floor((e.clientY - rect.top - g.top) / g.cellH);
    if (c < 0 || r < 0 || c >= view.cols.length || r >= view.rows.length) return null;
    return { c, r };
  };

  const toCell = ({ c, r }: { c: number; r: number }): Cell => ({ pair: view.cols[c] as number, round: view.rows[r] as number });

  /** Every grid cell on the straight line between two cells, so a quick drag leaves no gaps. */
  const line = (a: { c: number; r: number }, b: { c: number; r: number }) => {
    const out: { c: number; r: number }[] = [];
    const n = Math.max(Math.abs(b.c - a.c), Math.abs(b.r - a.r));
    for (let i = 1; i <= n; i++) out.push({ c: Math.round(a.c + ((b.c - a.c) * i) / n), r: Math.round(a.r + ((b.r - a.r) * i) / n) });
    return out;
  };

  return (
    <div class={`chart-scroll editor ${mode === "draw" ? "painting" : ""}`} tabIndex={0} role="region" aria-label="Drawing grid, scrolls in both directions">
      <canvas
        ref={canvas}
        role="img"
        aria-label={label}
        onPointerDown={(e) => {
          if (mode !== "draw" || e.button > 0) return;
          const idx = index(e);
          if (!idx) return;
          down.current = true;
          last.current = idx;
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          onStrokeStart(toCell(idx));
        }}
        onPointerMove={(e) => {
          if (!down.current) return;
          const idx = index(e);
          if (!idx || !last.current) return;
          if (idx.c === last.current.c && idx.r === last.current.r) return;
          for (const step of line(last.current, idx)) onStrokeCell(toCell(step));
          last.current = idx;
        }}
        onPointerUp={() => {
          if (!down.current) return;
          down.current = false;
          last.current = null;
          onStrokeEnd();
        }}
        onPointerCancel={() => {
          if (!down.current) return;
          down.current = false;
          last.current = null;
          onStrokeEnd();
        }}
      />
    </div>
  );
}
