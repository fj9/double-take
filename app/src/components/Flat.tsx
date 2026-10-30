import { useRef } from "preact/hooks";
import type { Chart } from "@doubletake/core";
import { isDark } from "../lib/settings";
import type { ChartView } from "../lib/render";
import { useWidth } from "../lib/useWidth";
import { ChartCanvas } from "./ChartCanvas";

/** A chart laid flat, sized to fit its box. `picture` shows it as it will look knitted; `bodyOnly` leaves out the crown. */
export function Flat({ chart, inside, wrap, label, picture, bodyOnly }: { chart: Chart; inside?: boolean; wrap?: boolean; label: string; picture?: boolean; bodyOnly?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const once = Array.from({ length: 112 }, (_, i) => (inside ? i + 1 : 112 - i));
  const cols = wrap ? [...once, ...once] : once;
  const cellW = Math.max(1.2, (width - 40) / cols.length);
  const last = bodyOnly ? 75 : 95;
  const view: ChartView = { chart, cols, rows: Array.from({ length: last }, (_, i) => last - i), cellW, showDuplicate: true, inside: !!inside, highContrast: false, dark: isDark(), picture };
  return (
    <div ref={box} class="chart-box" style="margin:0;min-width:0;max-width:100%">
      <ChartCanvas view={view} label={label} />
    </div>
  );
}
