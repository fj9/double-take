import { DUPLICATE_STOP, DUPLICATE_WARN } from "@doubletake/core";

export interface DupRow {
  name: string;
  hex: string;
  /** Slider position 1 (less) to 12 (more). The smallest patch kept is 13 minus this. */
  p: number;
  use: boolean;
  /** Share of the hat and patches left, from the finished chart. */
  share: number;
  patches: number;
  smallest: number | null;
  removedPatches: number;
}

interface Props {
  rows: DupRow[];
  /** Position of the main slider. */
  all: number;
  total: number;
  /** One slider per colour (when there is more than one duplicate colour). */
  perColour: boolean;
  onAll: (p: number) => void;
  onRow: (index: number, p: number) => void;
  onUse: (index: number, use: boolean) => void;
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
export const smallest = (p: number) => 13 - p;

/** How much duplicate stitch to keep: one slider for all, a slider and a switch for each colour, and what it adds up to. */
export function DuplicateAmount({ rows, all, total, perColour, onAll, onRow, onUse }: Props) {
  const mixed = perColour && rows.some((r) => r.p !== rows[0]?.p);
  const level = total > DUPLICATE_STOP ? "stop" : total > DUPLICATE_WARN ? "warn" : "ok";
  const message =
    level === "stop"
      ? "Too much to do well. Make the smallest patch bigger, or use fewer colours."
      : level === "warn"
        ? "A lot of embroidery. Allow plenty of time, or make the smallest patch bigger."
        : "A manageable amount of embroidery.";
  return (
    <div>
      <label class="field" style="margin:0">
        <span class="small muted">{perColour ? "All the colours" : "Amount of duplicate stitch"}</span>
        <input class="range" type="range" min="1" max="12" step="1" value={all} aria-label="Amount of duplicate stitch, from less to more" onInput={(e) => onAll(Number((e.currentTarget as HTMLInputElement).value))} />
      </label>
      <div class="row between small muted" style="margin:0 0 8px">
        <span>Less</span>
        <span>More</span>
      </div>
      <p class="small" style="margin:0 0 12px">
        Smallest patch kept: <strong>{mixed ? "varies by colour" : `${smallest(all)} ${smallest(all) === 1 ? "square" : "squares"}`}</strong>
      </p>

      <p class="small" style="margin:0 0 4px">
        Total: <strong>{pct(total)}</strong> of the hat
      </p>
      <div class="gauge" role="img" aria-label={`${pct(total)} of the hat is duplicate stitch. Marks at ${pct(DUPLICATE_WARN)} and ${pct(DUPLICATE_STOP)}.`}>
        {rows.map((r, i) => (
          <span key={i} style={`width:${Math.min(100, (r.share / DUPLICATE_STOP) * 100)}%;background:${r.hex}`} />
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

      {perColour && (
        <div class="list" style="margin-top:8px">
          {rows.map((r, i) => (
            <div key={i}>
              <div class="row" style="gap:8px">
                <span class="swatch sm" style={`background:${r.hex};margin:0`} aria-hidden="true" />
                <strong style="flex:1">{r.name}</strong>
                <span class="small num">{r.use ? pct(r.share) : "left out"}</span>
              </div>
              <p class="small muted" style={`margin:2px 0 4px 26px;${r.use && r.patches === 0 ? "color:var(--error)" : ""}`}>
                {!r.use
                  ? "Its squares take the colour around them."
                  : r.patches === 0
                    ? `Disappears at this setting. All ${r.removedPatches} patches are too small.`
                    : `${r.patches} ${r.patches === 1 ? "patch" : "patches"}, smallest ${r.smallest ?? 0} ${r.smallest === 1 ? "square" : "squares"}${r.removedPatches ? `, ${r.removedPatches} removed` : ""}`}
              </p>
              <div class="row" style="gap:8px;flex-wrap:wrap;margin-left:26px">
                <input class="range" style="flex:1;min-width:140px" type="range" min="1" max="12" step="1" value={r.p} disabled={!r.use} aria-label={`Amount of ${r.name} duplicate stitch, from less to more`} onInput={(e) => onRow(i, Number((e.currentTarget as HTMLInputElement).value))} />
                <label class="check small">
                  <input type="checkbox" checked={r.use} onChange={(e) => onUse(i, (e.currentTarget as HTMLInputElement).checked)} />
                  Use this colour
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
