import { useEffect, useRef, useState } from "preact/hooks";
import {
  LAST_ROUND,
  MAX_DUPLICATE_LAYERS,
  NO_SYMMETRY,
  REPEATS,
  addDuplicateLayer,
  analyse,
  floodFill,
  hasDuplicate,
  outsideAt,
  paintCell,
  removeDuplicateLayer,
  setYarnLook,
  symmetricCells,
  withPlainCrown,
} from "@doubletake/core";
import type { Chart, EditLayer, Symmetry } from "@doubletake/core";
import { EditorCanvas } from "../components/EditorCanvas";
import type { Geometry } from "../lib/render";
import type { ChartView } from "../lib/render";
import type { Project } from "../lib/model";
import { editorZoom, editorZoomBy, highContrast, isDark } from "../lib/settings";
import { flushChartSave, saveChartSoon } from "../store";

type Tool = "pencil" | "fill" | "pick";

const ROWS = Array.from({ length: LAST_ROUND }, (_, i) => LAST_ROUND - i); // crown on top, round 1 at the bottom
const COLS = Array.from({ length: 112 }, (_, i) => 112 - i); // stitch 1 at the right

export function DrawScreen({ project }: { project: Project }) {
  const work = useRef<Chart>(structuredClone(project.chart));
  const workFor = useRef(project.id);
  if (workFor.current !== project.id) {
    work.current = structuredClone(project.chart);
    workFor.current = project.id;
  }
  const [, setTick] = useState(0);
  const redraw = () => setTick((n) => n + 1);
  const undoStack = useRef<Chart[]>([]);
  const redoStack = useRef<Chart[]>([]);
  const stroke = useRef<{ began: boolean; changed: boolean; picking: boolean }>({ began: false, changed: false, picking: false });

  const [name, setName] = useState(project.name);
  const [tool, setTool] = useState<Tool>("pencil");
  const [layer, setLayer] = useState<EditLayer>({ kind: "main" });
  const [colour, setColour] = useState("B");
  const [adding, setAdding] = useState(true);
  const [sym, setSym] = useState<Symmetry>(NO_SYMMETRY);
  const [mode, setMode] = useState<"draw" | "move">("draw");
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [plainFrom, setPlainFrom] = useState(86);
  const [checks, setChecks] = useState(() => analyse(work.current));

  useEffect(() => () => void flushChartSave(), []);

  const chart = work.current;
  const dupLayerIndex = layer.kind === "duplicate" ? layer.index : -1;
  // If the layer being drawn on was removed, fall back to the colours.
  if (layer.kind === "duplicate" && !chart.duplicate[layer.index]) setLayer({ kind: "main" });

  const paintValue = () => (layer.kind === "main" ? colour : adding ? "1" : "0");

  const commit = () => {
    saveChartSoon(project.id, work.current, name);
    setChecks(analyse(work.current));
  };
  const snapshot = () => {
    undoStack.current.push(structuredClone(work.current));
    if (undoStack.current.length > 60) undoStack.current.shift();
    redoStack.current = [];
  };
  const change = (fn: () => void) => {
    snapshot();
    fn();
    commit();
    redraw();
  };

  const applyCell = (round: number, pair: number): boolean => {
    let changed = false;
    for (const c of symmetricCells(round, pair, sym)) if (paintCell(work.current, layer, c.round, c.pair, paintValue())) changed = true;
    return changed;
  };

  const onStrokeStart = ({ round, pair }: { round: number; pair: number }) => {
    stroke.current = { began: false, changed: false, picking: tool === "pick" };
    if (tool === "pick") {
      if (layer.kind === "main") {
        const id = outsideAt(work.current, round, pair);
        if (id) setColour(id);
      } else {
        const l = work.current.duplicate[layer.index];
        if (l) setAdding(hasDuplicate(l, round, pair));
      }
      return;
    }
    snapshot();
    stroke.current.began = true;
    if (tool === "fill") {
      for (const c of symmetricCells(round, pair, sym)) {
        if (floodFill(work.current, layer, c.round, c.pair, paintValue()).length > 0) stroke.current.changed = true;
      }
    } else if (applyCell(round, pair)) stroke.current.changed = true;
    redraw();
  };
  const onStrokeCell = ({ round, pair }: { round: number; pair: number }) => {
    if (tool !== "pencil" || stroke.current.picking) return;
    if (applyCell(round, pair)) {
      stroke.current.changed = true;
      redraw();
    }
  };
  const onStrokeEnd = () => {
    const s = stroke.current;
    if (s.began && !s.changed) undoStack.current.pop();
    else if (s.began) commit();
    stroke.current = { began: false, changed: false, picking: false };
    redraw();
  };

  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(structuredClone(work.current));
    work.current = prev;
    commit();
    redraw();
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(structuredClone(work.current));
    work.current = next;
    commit();
    redraw();
  };

  const decorate = (ctx: CanvasRenderingContext2D, g: Geometry) => {
    const ink = isDark() ? "#e8edf5" : "#1b2a41";
    const gridW = COLS.length * g.cellW;
    // Where the crown starts
    const crownY = g.top + 20 * g.cellH;
    ctx.beginPath();
    ctx.moveTo(g.left, crownY);
    ctx.lineTo(g.left + gridW, crownY);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "#f26b5b";
    ctx.lineWidth = 2;
    if (sym.mirrorX) {
      const x = g.left + 56 * g.cellW;
      ctx.beginPath();
      ctx.moveTo(x, g.top);
      ctx.lineTo(x, g.top + ROWS.length * g.cellH);
      ctx.stroke();
    }
    if (sym.mirrorY) {
      const y = g.top + (LAST_ROUND - 38) * g.cellH + g.cellH / 2;
      ctx.beginPath();
      ctx.moveTo(g.left, y);
      ctx.lineTo(g.left + gridW, y);
      ctx.stroke();
    }
    if (sym.repeat > 1) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      const step = 112 / sym.repeat;
      for (let k = 1; k < sym.repeat; k++) {
        const x = g.left + (112 - k * step) * g.cellW;
        ctx.beginPath();
        ctx.moveTo(x, g.top);
        ctx.lineTo(x, g.top + ROWS.length * g.cellH);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  };

  const shown: Chart = { ...chart, duplicate: chart.duplicate.filter((_, i) => !hidden.has(i)) };
  const view: ChartView = {
    chart: shown,
    cols: COLS,
    rows: ROWS,
    cellW: editorZoom.value,
    showDuplicate: true,
    inside: false,
    highContrast: highContrast.value,
    dark: isDark(),
    decorate,
  };

  const mains = chart.yarns.filter((y) => y.role === "main");
  const select = (label: string, value: string, onChange: (v: string) => void, options: [string, string][]) => (
    <label class="field">
      <span class="small muted">{label}</span>
      <select class="select" value={value} onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div>
      <h1>Draw your chart</h1>
      <p class="muted small">
        Each square is one stitch pair, and its colour is the outside. The inside is the other colour. Round 1 is at the bottom, stitch 1 at the right. The line near the top is where the crown starts.
      </p>

      <label class="field">
        <span class="small muted">Name</span>
        <input
          class="input"
          value={name}
          onInput={(e) => {
            const v = (e.currentTarget as HTMLInputElement).value;
            setName(v);
            saveChartSoon(project.id, work.current, v);
          }}
        />
      </label>

      <section class="card editor-tools" aria-label="Drawing tools">
        <div class="stack">
          <div class="seg" role="group" aria-label="Tool">
            {(["pencil", "fill", "pick"] as Tool[]).map((t) => (
              <button key={t} aria-pressed={tool === t} onClick={() => setTool(t)}>
                {t === "pencil" ? "Pencil" : t === "fill" ? "Fill" : "Pick colour"}
              </button>
            ))}
          </div>

          <div class="seg" role="group" aria-label="What to draw on" style="flex-wrap:wrap">
            <button aria-pressed={layer.kind === "main"} onClick={() => setLayer({ kind: "main" })}>
              Colours
            </button>
            {chart.duplicate.map((l, i) => {
              const yarn = chart.yarns.find((y) => y.id === l.yarn);
              return (
                <button key={l.yarn} aria-pressed={dupLayerIndex === i} onClick={() => setLayer({ kind: "duplicate", index: i })}>
                  Duplicate: {yarn?.name ?? l.yarn}
                </button>
              );
            })}
          </div>

          {layer.kind === "main" ? (
            <div class="row" style="flex-wrap:wrap" role="group" aria-label="Colour to draw with">
              {mains.map((y) => (
                <button key={y.id} class="colour-btn" aria-pressed={colour === y.id} onClick={() => setColour(y.id)}>
                  <span class="swatch sm" style={`background:${y.hex}`} aria-hidden="true" />
                  {y.name} ({y.id})
                </button>
              ))}
            </div>
          ) : (
            <div class="seg" role="group" aria-label="Add or remove duplicate stitch">
              <button aria-pressed={adding} onClick={() => setAdding(true)}>
                Add duplicate stitch
              </button>
              <button aria-pressed={!adding} onClick={() => setAdding(false)}>
                Remove it
              </button>
            </div>
          )}

          <div class="grid2">
            {select("Mirror", `${sym.mirrorX ? "x" : ""}${sym.mirrorY ? "y" : ""}` || "none", (v) => setSym({ ...sym, mirrorX: v.includes("x"), mirrorY: v.includes("y") }), [
              ["none", "No mirror"],
              ["x", "Left and right"],
              ["y", "Top and bottom"],
              ["xy", "Both ways"],
            ])}
            {select("Repeat round the hat", String(sym.repeat), (v) => setSym({ ...sym, repeat: Number(v) }), REPEATS.map((n) => [String(n), n === 1 ? "No repeat" : `${n} times (every ${112 / n} pairs)`]))}
          </div>
          {sym.mirrorX && <p class="small muted" style="margin:0">Left and right mirrors across the seam and the middle dashed line, so the print still wraps.</p>}

          <div class="row" style="flex-wrap:wrap">
            <div class="seg" role="group" aria-label="Finger mode">
              <button aria-pressed={mode === "draw"} onClick={() => setMode("draw")}>
                Draw
              </button>
              <button aria-pressed={mode === "move"} onClick={() => setMode("move")}>
                Move around
              </button>
            </div>
            <div class="seg" role="group" aria-label="Zoom">
              <button aria-label="Zoom out" onClick={() => editorZoomBy(-1)}>
                −
              </button>
              <button aria-label="Zoom in" onClick={() => editorZoomBy(1)}>
                +
              </button>
            </div>
            <button class="btn small" disabled={undoStack.current.length === 0} onClick={undo}>
              Undo
            </button>
            <button class="btn small" disabled={redoStack.current.length === 0} onClick={redo}>
              Redo
            </button>
          </div>
        </div>
      </section>

      <section class="chart-box" aria-label="Drawing grid">
        <EditorCanvas
          view={view}
          mode={mode}
          label="Drawing grid: 112 stitch pairs across and 95 rounds up, crown at the top. Drawing needs a pointer or touch. You can also import a chart file."
          onStrokeStart={onStrokeStart}
          onStrokeCell={onStrokeCell}
          onStrokeEnd={onStrokeEnd}
        />
      </section>

      <details class="card">
        <summary class="summary">Colours, duplicate stitch and crown</summary>
        <div class="stack" style="margin-top:12px">
          {chart.yarns.map((y) => (
            <div key={y.id} class="row" style="flex-wrap:wrap">
              <input
                type="color"
                class="colour-input"
                aria-label={`Colour for ${y.name}`}
                value={y.hex}
                onInput={(e) => change(() => setYarnLook(work.current, y.id, { hex: (e.currentTarget as HTMLInputElement).value }))}
              />
              <input class="input" style="flex:1;min-width:140px" aria-label={`Name of yarn ${y.id}`} value={y.name} onChange={(e) => change(() => setYarnLook(work.current, y.id, { name: (e.currentTarget as HTMLInputElement).value }))} />
              <span class="small muted">
                {y.id}, {y.role === "main" ? "main colour" : "duplicate stitch"}
              </span>
              {y.role === "duplicate" && (
                <>
                  <label class="check small">
                    <input
                      type="checkbox"
                      checked={!hidden.has(chart.duplicate.findIndex((l) => l.yarn === y.id))}
                      onChange={(e) => {
                        const i = chart.duplicate.findIndex((l) => l.yarn === y.id);
                        const next = new Set(hidden);
                        if ((e.currentTarget as HTMLInputElement).checked) next.delete(i);
                        else next.add(i);
                        setHidden(next);
                      }}
                    />
                    Show
                  </label>
                  <button class="btn small danger" onClick={() => change(() => removeDuplicateLayer(work.current, chart.duplicate.findIndex((l) => l.yarn === y.id)))}>
                    Remove
                  </button>
                </>
              )}
            </div>
          ))}
          <button
            class="btn small"
            disabled={chart.duplicate.length >= MAX_DUPLICATE_LAYERS}
            onClick={() => {
              change(() => {
                const i = addDuplicateLayer(work.current, { name: "Duplicate colour", hex: "#2a5fd0" });
                if (i !== null) {
                  setLayer({ kind: "duplicate", index: i });
                  setAdding(true);
                }
              });
            }}
          >
            Add a duplicate stitch colour
          </button>
          <p class="small muted" style="margin:0">
            Duplicate stitch is worked on top of the knitting, after blocking, on both faces. Use it for small details in a third colour (up to {MAX_DUPLICATE_LAYERS}).
          </p>

          <div class="row" style="flex-wrap:wrap">
            <label class="small muted" for="plain-from">
              Make the crown plain from round
            </label>
            <input id="plain-from" class="input" style="width:90px" type="number" min={76} max={95} value={plainFrom} onInput={(e) => setPlainFrom(Number((e.currentTarget as HTMLInputElement).value))} />
            <button class="btn small" disabled={!(plainFrom >= 76 && plainFrom <= 95)} onClick={() => change(() => (work.current = withPlainCrown(work.current, plainFrom)))}>
              Make it plain
            </button>
          </div>
          <p class="small muted" style="margin:0">
            {chart.crown.variant === "plain" ? `The crown is plain from round ${chart.crown.plain_from}: the main colour A on the outside. ` : "The crown follows your print. "}
            Making it plain clears the print from that round up. Undo brings it back.
          </p>
        </div>
      </details>

      <section class="card" aria-label="Checks">
        <h2>Checks</h2>
        <ul class="small" style="margin:0 0 8px;padding-left:20px">
          {mains.map((y) => (
            <li key={y.id}>
              {y.name}: {Math.round((checks.outsideShare[y.id] ?? 0) * 100)}% of the outside
            </li>
          ))}
          {checks.duplicate.map((d) => (
            <li key={d.yarn}>
              {chart.yarns.find((y) => y.id === d.yarn)?.name} duplicate stitch: {d.patches} {d.patches === 1 ? "patch" : "patches"}, {Math.round(d.share * 100)}% of the hat
            </li>
          ))}
        </ul>
        {checks.warnings.map((w) => (
          <p key={w.code} class="small" style={`margin:0 0 8px;color:${w.level === "stop" ? "var(--error)" : "inherit"}`}>
            <strong>{w.level === "stop" ? "Too much: " : "Note: "}</strong>
            {w.message}
          </p>
        ))}
      </section>

      <a class="btn primary block" href={`#/p/${project.id}/review`}>
        Review and start knitting
      </a>
    </div>
  );
}
