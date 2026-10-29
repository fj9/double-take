import type { Chart } from "@doubletake/core";
import { textOn } from "../lib/render";

/** Every yarn with its colour, letter and name. Colour is never the only signal. */
export function Legend({ chart, showDecrease }: { chart: Chart; showDecrease?: boolean }) {
  return (
    <div class="card">
      <h3>Key</h3>
      <div class="legend">
        {chart.yarns.map((y) => (
          <span key={y.id}>
            <span class="glyph" style={`background:${y.hex};color:${textOn(y.hex)}`} aria-hidden="true">
              {y.id}
            </span>
            {y.name}
            {y.role === "duplicate" ? " (duplicate stitch dot)" : ""}
          </span>
        ))}
        {showDecrease && (
          <span>
            <span class="glyph" aria-hidden="true">
              /
            </span>
            right-leaning decrease
          </span>
        )}
      </div>
      <p class="small muted" style="margin:8px 0 0">
        Each square is one stitch pair. The square shows the outside colour, and the inside is the other colour. Heavy lines mark every 5th stitch and round.
      </p>
    </div>
  );
}
