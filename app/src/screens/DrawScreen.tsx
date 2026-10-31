import { useEffect, useRef, useState } from "preact/hooks";
import {
  LAST_ROUND,
  MAX_DUPLICATE_LAYERS,
  NO_SYMMETRY,
  REPEATS,
  addDuplicateLayer,
  addStripeYarn,
  analyse,
  crownPrint,
  fadeCrown,
  fillStripes,
  floodFill,
  hasDuplicate,
  outsideAt,
  paintCell,
  paintStripeCell,
  removeDuplicateLayer,
  removeSmallPatches,
  setLayerFaces,
  setRoundPairs,
  smallPatches,
  setYarnLook,
  symmetricCells,
  visibleYarnAt,
} from "@doubletake/core";
import type { Chart, EditLayer, Symmetry } from "@doubletake/core";
import { DrawStatus } from "../components/DrawStatus";
import { EditorCanvas } from "../components/EditorCanvas";
import { StripePlanner } from "../components/StripePlanner";
import type { Geometry } from "../lib/render";
import type { ChartView } from "../lib/render";
import type { Project } from "../lib/model";
import { tileDraws } from "../lib/crop";
import * as db from "../lib/db";
import { download, slug } from "../lib/files";
import { decodePicture } from "../lib/decode";
import { editorZoom, editorZoomBy, highContrast, isDark } from "../lib/settings";
import { blobToCanvas, canvasToBlob, newUnderlay, pixelsToCanvas } from "../lib/underlay";
import type { Underlay } from "../lib/underlay";
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
  const [checks, setChecks] = useState(() => analyse(work.current));
  const [look, setLook] = useState<"chart" | "picture">("chart");
  const [showSingles, setShowSingles] = useState(false);
  const [tidyMin, setTidyMin] = useState(2);
  const [tidyLayer, setTidyLayer] = useState<number | null>(null);

  useEffect(() => () => void flushChartSave(), []);

  // A picture to trace over. It is kept on this device only and is not part of the chart.
  const [underlay, setUnderlay] = useState<Underlay | null>(null);
  const [underlayError, setUnderlayError] = useState<string | null>(null);
  const underlayBlob = useRef<Blob | null>(null);
  const underlayTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tiled = useRef<{ key: string; src: HTMLCanvasElement; canvas: HTMLCanvasElement } | null>(null);
  useEffect(() => {
    let cancelled = false;
    db.getUnderlay(project.id)
      .then(async (u) => {
        if (!u || cancelled) return;
        underlayBlob.current = u.blob;
        setUnderlay({ canvas: await blobToCanvas(u.blob), crop: u.crop, opacity: u.opacity, visible: u.visible, mirror: u.mirror ?? false });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [project.id]);
  const saveUnderlay = (u: Underlay) => {
    clearTimeout(underlayTimer.current);
    underlayTimer.current = setTimeout(() => {
      const blob = underlayBlob.current;
      if (blob) void db.putUnderlay({ projectId: project.id, blob, crop: u.crop, opacity: u.opacity, visible: u.visible, mirror: u.mirror }).catch(() => undefined);
    }, 400);
  };
  const changeUnderlay = (patch: Partial<Underlay>) => {
    if (!underlay) return;
    const next = { ...underlay, ...patch };
    setUnderlay(next);
    saveUnderlay(next);
  };
  const chooseUnderlay = async (file: File | undefined) => {
    if (!file) return;
    setUnderlayError(null);
    try {
      const canvas = pixelsToCanvas(await decodePicture(file));
      underlayBlob.current = await canvasToBlob(canvas);
      const next = newUnderlay(canvas);
      // Keep it first, then show it, so a quick reload never finds a picture that wasn't saved
      await db.putUnderlay({ projectId: project.id, blob: underlayBlob.current, crop: next.crop, opacity: next.opacity, visible: true, mirror: false });
      setUnderlay(next);
    } catch (e) {
      setUnderlayError(e instanceof Error ? e.message : "Couldn’t open that picture.");
    }
  };
  const removeUnderlay = async () => {
    clearTimeout(underlayTimer.current);
    underlayBlob.current = null;
    // Delete it first, then hide it, so a quick reload never brings it back
    await db.deleteUnderlay(project.id).catch(() => undefined);
    setUnderlay(null);
  };

  const chart = work.current;
  const striped = chart.mode === "stripes";
  const dupLayerIndex = layer.kind === "duplicate" ? layer.index : -1;
  // If the layer being drawn on was removed, fall back to the colours.
  if (layer.kind === "duplicate" && !chart.duplicate[layer.index]) setLayer({ kind: "main" });

  const paintValue = () => (layer.kind === "main" ? colour : adding ? "1" : "0");
  const paintAt = (round: number, pair: number) => (striped ? paintStripeCell(work.current, round, pair, colour) : paintCell(work.current, layer, round, pair, paintValue()));

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
    for (const c of symmetricCells(round, pair, sym)) if (paintAt(c.round, c.pair)) changed = true;
    return changed;
  };

  const onStrokeStart = ({ round, pair }: { round: number; pair: number }) => {
    stroke.current = { began: false, changed: false, picking: tool === "pick" };
    if (tool === "pick") {
      if (layer.kind === "main") {
        const id = striped ? visibleYarnAt(work.current, round, pair) : outsideAt(work.current, round, pair);
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
        const filled = striped ? fillStripes(work.current, c.round, c.pair, colour) : floodFill(work.current, layer, c.round, c.pair, paintValue());
        if (filled.length > 0) stroke.current.changed = true;
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
    if (underlay?.visible) {
      // The picture covers the body (rounds 1-75). Its frame has the shape of the fabric, so it fits the grid exactly.
      const rect = { x: g.left, y: g.top + 20 * g.cellH, w: COLS.length * g.cellW, h: 75 * g.cellH };
      const key = `${rect.w}|${underlay.crop.zoom}|${underlay.crop.cx}|${underlay.crop.cy}|${underlay.mirror}`;
      let cached = tiled.current;
      if (!cached || cached.key !== key || cached.src !== underlay.canvas) {
        // Build the (possibly repeated) picture once at full strength, so copies don't overlap and double up when faded
        const dpr = window.devicePixelRatio || 1;
        const off = document.createElement("canvas");
        off.width = Math.max(1, Math.ceil(rect.w * dpr));
        off.height = Math.max(1, Math.ceil(rect.h * dpr));
        const octx = off.getContext("2d");
        if (octx) {
          octx.scale(dpr, dpr);
          for (const t of tileDraws(underlay.canvas.width, underlay.canvas.height, underlay.crop, underlay.mirror)) {
            const dx = t.nx * rect.w - 0.3;
            const dy = t.ny * rect.h - 0.3;
            const dw = t.nw * rect.w + 0.6;
            const dh = t.nh * rect.h + 0.6;
            octx.save();
            octx.translate(dx + dw / 2, dy + dh / 2);
            octx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
            octx.drawImage(underlay.canvas, t.sx, t.sy, t.sw, t.sh, -dw / 2, -dh / 2, dw, dh);
            octx.restore();
          }
        }
        cached = { key, src: underlay.canvas, canvas: off };
        tiled.current = cached;
      }
      ctx.save();
      ctx.globalAlpha = underlay.opacity;
      ctx.drawImage(cached.canvas, rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    }
    const gridW = COLS.length * g.cellW;
    if (showSingles) {
      ctx.save();
      ctx.strokeStyle = "#f26b5b";
      ctx.lineWidth = 2;
      for (const patch of smallPatches(work.current, null, 2)) {
        for (const c of patch.cells) ctx.strokeRect(g.left + (112 - c.pair) * g.cellW - 1, g.top + (LAST_ROUND - c.round) * g.cellH - 1, g.cellW + 2, g.cellH + 2);
      }
      ctx.restore();
    }
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
    picture: look === "picture",
    solidDuplicate: true,
  };

  const mains = chart.yarns.filter((y) => y.role === "main" || y.role === "stripe");
  const singles = smallPatches(chart, null, 2).length;
  const tidyCount = smallPatches(chart, tidyLayer, tidyMin);
  const tidyCells = tidyCount.reduce((n, p) => n + p.cells.length, 0);
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

      <p class="card note small phone-only" style="margin:0 0 12px">
        Drawing is easier on a tablet or computer. Make the chart there and bring it to your phone.{" "}
        <button class="btn small" onClick={() => download(`${slug(name)}.doubletake.json`, JSON.stringify(work.current, null, 1))}>
          Save the chart file
        </button>{" "}
        <a href="#/">Import it on Home</a>
      </p>

      <div class="draw-layout">
      <div class="draw-side">
      <section class="card editor-tools" aria-label="Drawing tools">
        <div class="stack">
          <div class="seg" role="group" aria-label="Tool">
            {(["pencil", "fill", "pick"] as Tool[]).map((t) => (
              <button key={t} aria-pressed={tool === t} onClick={() => setTool(t)}>
                {t === "pencil" ? "Pencil" : t === "fill" ? "Fill" : "Pick colour"}
              </button>
            ))}
          </div>

          {!striped && (
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
          )}

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
            <div class="seg" role="group" aria-label="How to show it">
              <button aria-pressed={look === "chart"} onClick={() => setLook("chart")}>
                Chart
              </button>
              <button aria-pressed={look === "picture"} onClick={() => setLook("picture")}>
                Picture
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

      {striped && (
        <section class="card" aria-labelledby="stripes-card">
          <h2 id="stripes-card">Stripes</h2>
          <StripePlanner chart={chart} total={75} onPairs={(pairs) => change(() => void setRoundPairs(work.current, pairs))} />
        </section>
      )}

      <section class="card" aria-labelledby="colours-card">
        <h2 id="colours-card">Colours and layers</h2>
        <div class="stack">
          {chart.yarns.map((y) => {
            const i = chart.duplicate.findIndex((l) => l.yarn === y.id);
            const layer = chart.duplicate[i];
            return (
              <div key={y.id} class="stack" style="gap:6px">
                <div class="row" style="flex-wrap:wrap">
                  <input type="color" class="colour-input" aria-label={`Colour for ${y.name}`} value={y.hex} onInput={(e) => change(() => setYarnLook(work.current, y.id, { hex: (e.currentTarget as HTMLInputElement).value }))} />
                  <input class="input" style="flex:1;min-width:120px" aria-label={`Name of yarn ${y.id}`} value={y.name} onChange={(e) => change(() => setYarnLook(work.current, y.id, { name: (e.currentTarget as HTMLInputElement).value }))} />
                  <span class="small muted">{y.id}, {y.role === "main" ? "main colour" : y.role === "stripe" ? "stripe colour" : "duplicate stitch"}</span>
                </div>
                {layer && !striped && (
                  <div class="row" style="flex-wrap:wrap;margin-left:4px">
                    <label class="check small">
                      <input
                        type="checkbox"
                        checked={!hidden.has(i)}
                        onChange={(e) => {
                          const next = new Set(hidden);
                          if ((e.currentTarget as HTMLInputElement).checked) next.delete(i);
                          else next.add(i);
                          setHidden(next);
                        }}
                      />
                      Show
                    </label>
                    <label class="small row" style="gap:6px">
                      Worked on
                      <select class="select" style="width:auto" aria-label={`Faces for ${y.name}`} value={layer.faces} onChange={(e) => change(() => setLayerFaces(work.current, i, (e.currentTarget as HTMLSelectElement).value as "both" | "outside"))}>
                        <option value="both">both faces</option>
                        <option value="outside">outside only</option>
                      </select>
                    </label>
                    <button class="btn small danger" onClick={() => change(() => removeDuplicateLayer(work.current, i))}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {striped ? (
            <button class="btn small" disabled={chart.yarns.length >= 6} onClick={() => change(() => void addStripeYarn(work.current, { name: `Colour ${String.fromCharCode(64 + chart.yarns.length + 1)}`, hex: "#2a5fd0" }))}>
              Add a colour
            </button>
          ) : (
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
          )}
          <p class="small muted" style="margin:0">
            {striped
              ? "Every round is worked in two of these colours. Draw a third colour in a round and it is added on top with duplicate stitch."
              : `Two colours are knitted. Duplicate stitch is worked on top, after blocking, for small details in more colours (up to ${MAX_DUPLICATE_LAYERS} more).`}
          </p>
        </div>
      </section>

      {chart.duplicate.length > 0 && (
        <section class="card" aria-labelledby="tidy-card">
          <h2 id="tidy-card">Tidy duplicate stitch</h2>
          <div class="stack">
            <label class="check">
              <input type="checkbox" checked={showSingles} onChange={(e) => setShowSingles((e.currentTarget as HTMLInputElement).checked)} />
              Show single squares ({singles})
            </label>
            <button class="btn small" disabled={singles === 0} onClick={() => change(() => removeSmallPatches(work.current, null, 2))}>
              Remove single squares
            </button>
            <div class="row" style="flex-wrap:wrap">
              <label class="small row" style="gap:6px">
                Patches smaller than
                <select class="select" style="width:auto" aria-label="Smaller than this many squares" value={tidyMin} onChange={(e) => setTidyMin(Number((e.currentTarget as HTMLSelectElement).value))}>
                  {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>
                      {n} squares
                    </option>
                  ))}
                </select>
              </label>
              <label class="small row" style="gap:6px">
                in
                <select class="select" style="width:auto" aria-label="Which colours to tidy" value={tidyLayer === null ? "all" : String(tidyLayer)} onChange={(e) => setTidyLayer((e.currentTarget as HTMLSelectElement).value === "all" ? null : Number((e.currentTarget as HTMLSelectElement).value))}>
                  <option value="all">all colours</option>
                  {chart.duplicate.map((l, i) => (
                    <option key={l.yarn} value={i}>
                      {chart.yarns.find((y) => y.id === l.yarn)?.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p class="small muted" style="margin:0">
              {tidyCount.length === 0 ? "Nothing that small." : `Would remove ${tidyCount.length} ${tidyCount.length === 1 ? "patch" : "patches"} (${tidyCells} ${tidyCells === 1 ? "square" : "squares"}).`}
            </p>
            <button class="btn small" disabled={tidyCount.length === 0} onClick={() => change(() => removeSmallPatches(work.current, tidyLayer, tidyMin))}>
              Remove them
            </button>
            <p class="small muted" style="margin:0">Undo brings them back.</p>
          </div>
        </section>
      )}
      </div>

      <div class="draw-main">
      <DrawStatus chart={chart} checks={checks} />
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

      {crownPrint(chart) && (
        <p class="card note small" style="margin:0 0 12px">
          <strong>Colour in the crown.</strong> Changing colour in the crown makes the knitting more complicated, because the rounds are short and the decreases move across the pattern, but it can be done. One colour from round 85 keeps it simple.
        </p>
      )}

      <details class="card">
        <summary class="summary">Trace over a picture</summary>
        <div class="stack" style="margin-top:12px">
          <p class="small muted" style="margin:0">
            Put a picture faintly over the grid and draw over it. It covers the body, rounds 1 to 75. It isn’t part of your chart, and it stays on this device.
          </p>
          <div class="row" style="flex-wrap:wrap">
            <input id="trace-file" class="sr-only" aria-label="Choose a picture to trace over" type="file" accept="image/*" onChange={(e) => chooseUnderlay((e.currentTarget as HTMLInputElement).files?.[0])} />
            <label class="btn small" for="trace-file">
              {underlay ? "Choose a different picture" : "Choose a picture"}
            </label>
            {underlay && (
              <button class="btn small danger" onClick={removeUnderlay}>
                Remove the picture
              </button>
            )}
          </div>
          {underlayError && (
            <p class="small" role="alert" style="margin:0;color:var(--error)">
              {underlayError}
            </p>
          )}
          {underlay && (
            <>
              <label class="check">
                <input type="checkbox" checked={underlay.visible} onChange={(e) => changeUnderlay({ visible: (e.currentTarget as HTMLInputElement).checked })} />
                Show the picture
              </label>
              <label class="field">
                <span class="small muted">How strong: {Math.round(underlay.opacity * 100)}%</span>
                <input class="range" type="range" min="0.05" max="1" step="0.05" value={underlay.opacity} aria-label="How strong the picture shows" onInput={(e) => changeUnderlay({ opacity: Number((e.currentTarget as HTMLInputElement).value) })} />
              </label>
              <label class="field">
                <span class="small muted">Zoom: {underlay.crop.zoom.toFixed(2).replace(/0$/, "")}{underlay.crop.zoom < 1 ? ", repeating the picture" : ""}</span>
                <input class="range" type="range" min="0.2" max="4" step="0.05" value={underlay.crop.zoom} aria-label="Zoom the picture" onInput={(e) => changeUnderlay({ crop: { ...underlay.crop, zoom: Number((e.currentTarget as HTMLInputElement).value) } })} />
              </label>
              {underlay.crop.zoom < 1 && (
                <label class="check">
                  <input type="checkbox" checked={underlay.mirror} onChange={(e) => changeUnderlay({ mirror: (e.currentTarget as HTMLInputElement).checked })} />
                  Flip every other copy so the edges match
                </label>
              )}
              <label class="field">
                <span class="small muted">Left to right</span>
                <input class="range" type="range" min="0" max="1" step="0.01" value={underlay.crop.cx} aria-label="Move the picture left or right" onInput={(e) => changeUnderlay({ crop: { ...underlay.crop, cx: Number((e.currentTarget as HTMLInputElement).value) } })} />
              </label>
              <label class="field">
                <span class="small muted">Up and down</span>
                <input class="range" type="range" min="0" max="1" step="0.01" value={underlay.crop.cy} aria-label="Move the picture up or down" onInput={(e) => changeUnderlay({ crop: { ...underlay.crop, cy: Number((e.currentTarget as HTMLInputElement).value) } })} />
              </label>
            </>
          )}
        </div>
      </details>

      <details class="card">
        <summary class="summary">Crown</summary>
        <div class="stack" style="margin-top:12px">
          <p class="small muted" style="margin:0">
            The crown is part of the grid, so you can draw all the way to the top. Colour changes in the crown make the knitting more complicated, because the rounds are short and the decreases move, but it can be done.
          </p>
          <div class="row" style="flex-wrap:wrap">
            <button class="btn small" disabled={!crownPrint(chart)} onClick={() => change(() => fadeCrown(work.current))}>
              Fade the print out of the crown
            </button>
            <span class="small muted">Keeps the print next to the body, thins it out, and makes the crown one colour from round 85. Undo brings it back.</span>
          </div>
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
      </div>
    </div>
  );
}
