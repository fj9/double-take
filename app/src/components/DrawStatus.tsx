import { useState } from "preact/hooks";
import { DUPLICATE_STOP, DUPLICATE_WARN } from "@doubletake/core";
import type { Analysis, Chart } from "@doubletake/core";

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

/** A line that stays in view while drawing: how much duplicate stitch there is. Tap it for the gauge and each colour. */
export function DrawStatus({ chart, checks }: { chart: Chart; checks: Analysis }) {
  const [open, setOpen] = useState(false);
  if (chart.duplicate.length === 0) return null;
  const total = checks.duplicateShare;
  const level = total > DUPLICATE_STOP ? "stop" : total > DUPLICATE_WARN ? "warn" : "ok";
  const patches = checks.duplicate.reduce((n, d) => n + d.patches, 0);
  const nColours = chart.mode === "stripes" ? chart.yarns.length : 2 + chart.duplicate.length;
  const message =
    level === "stop"
      ? "Too much to do well. Use fewer colours, make the areas bigger, or think about stripes."
      : level === "warn"
        ? "A lot of embroidery. Allow plenty of time, or use fewer, bigger areas."
        : "A manageable amount of embroidery.";
  return (
    <div class="draw-status">
      <button class={`status-chip ${level}`} aria-expanded={open} aria-controls="draw-status-panel" onClick={() => setOpen(!open)}>
        <span>
          Duplicate stitch {pct(total)} · {nColours} colours · {patches} {patches === 1 ? "patch" : "patches"}
        </span>
        <span aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div id="draw-status-panel" class="card" style="margin:6px 0 0">
          <div class="gauge" role="img" aria-label={`${pct(total)} of the hat is duplicate stitch. Marks at ${pct(DUPLICATE_WARN)} and ${pct(DUPLICATE_STOP)}.`}>
            {checks.duplicate.map((d) => (
              <span key={d.yarn} style={`width:${Math.min(100, (d.share / DUPLICATE_STOP) * 100)}%;background:${chart.yarns.find((y) => y.id === d.yarn)?.hex ?? "#888"}`} />
            ))}
            <i class="mark" style={`left:${(DUPLICATE_WARN / DUPLICATE_STOP) * 100}%`} />
          </div>
          <div class="gauge-scale small muted" aria-hidden="true">
            <span>0%</span>
            <span style={`left:${(DUPLICATE_WARN / DUPLICATE_STOP) * 100}%`}>10%</span>
            <span style="right:0;left:auto">25%</span>
          </div>
          <p class={`gauge-msg ${level}`} role="status">
            {message}
          </p>
          <ul class="small" style="margin:8px 0 0;padding-left:20px">
            {checks.duplicate.map((d) => (
              <li key={d.yarn}>
                {chart.yarns.find((y) => y.id === d.yarn)?.name}: {pct(d.share)}, {d.patches} {d.patches === 1 ? "patch" : "patches"}
                {d.singles > 0 ? `, ${d.singles} of one square` : ""}
              </li>
            ))}
          </ul>
          {level !== "ok" && <p class="small muted" style="margin:8px 0 0">Duplicate stitch suits small scattered accents. Stripes suit big areas that run in layers.</p>}
        </div>
      )}
    </div>
  );
}
