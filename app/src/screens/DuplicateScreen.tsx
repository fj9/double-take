import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { findAllPatches } from "@doubletake/core";
import type { Chart, Patch } from "@doubletake/core";
import { ChartCanvas } from "../components/ChartCanvas";
import { DUPLICATE_INTRO, DUPLICATE_TIPS, HELP } from "../content";
import { patchKey, patchesDone, togglePatchFace } from "../lib/model";
import { useWidth } from "../lib/useWidth";
import type { Progress } from "../lib/model";
import { patchWindow } from "../lib/patchView";
import { cellKey, drawMap, mapHit, type ChartView, type MapState } from "../lib/render";
import { highContrast, isDark } from "../lib/settings";
import { saveProgress } from "../store";

interface Item {
  key: string;
  layer: number;
  patch: Patch;
  yarnName: string;
  yarnHex: string;
  number: number;
}

export function DuplicateScreen({ chart, progress }: { chart: Chart; progress: Progress }) {
  const items = useMemo<Item[]>(() => {
    let n = 0;
    return findAllPatches(chart).flatMap((layer, li) =>
      layer.map((patch) => {
        const yarn = chart.yarns.find((y) => y.id === patch.yarn);
        return { key: patchKey(li, patch.index), layer: li, patch, yarnName: yarn?.name ?? patch.yarn, yarnHex: yarn?.hex ?? "#2a5fd0", number: ++n };
      }),
    );
  }, [chart]);

  const isDone = (it: Item) => {
    const t = progress.patches[it.key];
    return !!t && t.outside && (it.patch.faces === "outside" || t.inside);
  };
  const firstTodo = items.find((it) => !isDone(it));
  const [selectedKey, setSelectedKey] = useState<string | null>(firstTodo?.key ?? items[0]?.key ?? null);
  const [face, setFace] = useState<"outside" | "inside">("outside");
  const selected = items.find((it) => it.key === selectedKey) ?? null;

  const mapBox = useRef<HTMLDivElement>(null);
  const mapCanvas = useRef<HTMLCanvasElement>(null);
  const detailBox = useRef<HTMLDivElement>(null);
  const mapWidth = useWidth(mapBox);
  const detailWidth = useWidth(detailBox);

  const mapState = useMemo<MapState>(() => {
    const cellPatch = new Map<string, string>();
    const colours = new Map<string, string>();
    const done = new Set<string>();
    for (const it of items) {
      colours.set(it.key, it.yarnHex);
      if (isDone(it)) done.add(it.key);
      for (const c of it.patch.cells) cellPatch.set(cellKey(c.round, c.pair), it.key);
    }
    return { chart, cellPatch, done, selected: selectedKey, colours, cssWidth: mapWidth, dark: isDark() };
  }, [items, progress.patches, selectedKey, mapWidth]);

  useEffect(() => {
    if (mapCanvas.current) drawMap(mapCanvas.current, mapState);
  }, [mapState]);

  if (items.length === 0) {
    return (
      <div>
        <h1>Duplicate stitch</h1>
        <p>This chart has no duplicate stitch, so there is nothing to do here.</p>
      </div>
    );
  }

  const doneCount = patchesDone(progress, items.map((it) => ({ key: it.key, faces: it.patch.faces })));
  const nextTodo = () => {
    const start = Math.max(0, items.findIndex((it) => it.key === selectedKey));
    for (let i = 1; i <= items.length; i++) {
      const it = items[(start + i) % items.length] as Item;
      if (!isDone(it)) return it;
    }
    return null;
  };

  let detail = null;
  if (selected) {
    const win = patchWindow(selected.patch);
    const viewFace = selected.patch.faces === "outside" ? "outside" : face;
    const cols = viewFace === "outside" ? win.outsideCols : win.insideCols;
    const cellW = Math.max(14, Math.min(40, Math.floor((detailWidth - 60) / cols.length)));
    const view: ChartView = {
      chart,
      cols,
      rows: win.rows,
      cellW,
      showDuplicate: true,
      inside: viewFace === "inside",
      highContrast: highContrast.value,
      dark: isDark(),
      highlight: new Set(selected.patch.cells.map((c) => cellKey(c.round, c.pair))),
    };
    const tick = progress.patches[selected.key];
    const two = selected.patch.faces === "both";
    detail = (
      <section class="card patch-detail" aria-labelledby="patch-title">
        <h2 id="patch-title">
          Patch {selected.number} of {items.length}
        </h2>
        <p class="small muted">
          <span class="swatch sm" style={`background:${selected.yarnHex}`} aria-hidden="true" />
          {selected.yarnName} · {selected.patch.cells.length} squares · rounds {win.firstRound === win.lastRound ? win.firstRound : `${win.firstRound}–${win.lastRound}`}
          {two ? " · both faces" : " · outside only"}
        </p>
        {two && (
          <div class="seg" role="group" aria-label="Which face to look at" style="margin-bottom:12px">
            <button aria-pressed={viewFace === "outside"} onClick={() => setFace("outside")}>
              Outside
            </button>
            <button aria-pressed={viewFace === "inside"} onClick={() => setFace("inside")}>
              Inside view
            </button>
          </div>
        )}
        <div ref={detailBox}>
          <div class="chart-box" style="margin-bottom:8px">
            <ChartCanvas
              view={view}
              label={`Patch ${selected.number}, ${viewFace} view, rounds ${win.firstRound} to ${win.lastRound}. The squares to cover are marked with ${selected.yarnName} dots.`}
              scrollTo="start"
            />
          </div>
        </div>
        {viewFace === "inside" && (
          <p class="small muted">The inside view is how you see the patch looking at the inside of the hat. Each patch sits directly behind the same patch on the outside.</p>
        )}
        <div class="row" style="flex-wrap:wrap;margin:12px 0">
          <button class="btn" aria-pressed={!!tick?.outside} onClick={() => saveProgress(togglePatchFace(progress, selected.key, "outside"))}>
            {tick?.outside ? "Outside done ✓" : "Outside: mark as done"}
          </button>
          {two && (
            <button class="btn" aria-pressed={!!tick?.inside} onClick={() => saveProgress(togglePatchFace(progress, selected.key, "inside"))}>
              {tick?.inside ? "Inside done ✓" : "Inside: mark as done"}
            </button>
          )}
        </div>
        <button
          class="btn primary block"
          disabled={!nextTodo()}
          onClick={() => {
            const n = nextTodo();
            if (n) setSelectedKey(n.key);
          }}
        >
          {nextTodo() ? "Next patch to do" : "All patches done"}
        </button>
      </section>
    );
  }

  return (
    <div>
      <h1>Duplicate stitch</h1>
      <p>{DUPLICATE_INTRO}</p>
      {HELP.duplicate && (
        <p>
          <a href={HELP.duplicate} target="_blank" rel="noreferrer">
            Watch the tutorial
          </a>
        </p>
      )}
      <details class="card">
        <summary style="min-height:44px;display:flex;align-items:center;cursor:pointer">Tips</summary>
        {DUPLICATE_TIPS.map((t) => (
          <div key={t.title}>
            <h3>{t.title}</h3>
            <p class="small">{t.body}</p>
          </div>
        ))}
      </details>

      <div class="card">
        <div class="row between">
          <strong class="num">
            {doneCount} of {items.length} patches done
          </strong>
        </div>
        <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={doneCount} aria-label="Patches done" style="margin:8px 0">
          <div style={`width:${(doneCount / items.length) * 100}%`} />
        </div>
        <div class="map-wrap" ref={mapBox}>
          <canvas
            ref={mapCanvas}
            role="img"
            aria-label="Map of the whole hat laid flat with every duplicate stitch patch. The list below has the same patches."
            onClick={(e) => {
              const c = mapCanvas.current;
              if (!c) return;
              const rect = c.getBoundingClientRect();
              const id = mapHit(mapState, ((e.clientX - rect.left) * mapState.cssWidth) / rect.width, ((e.clientY - rect.top) * mapState.cssWidth) / rect.width);
              if (id) {
                setSelectedKey(id);
                document.getElementById("patch-title")?.scrollIntoView({ block: "nearest" });
              }
            }}
          />
        </div>
        <p class="small muted" style="margin:8px 0 0">
          The hat laid flat: round 1 at the bottom, stitch 1 at the right. Solid squares are to do, pale squares are done, and the coral patch is the one you have open.
        </p>
      </div>

      {detail}

      <div class="card">
        <h2>All patches</h2>
        <div class="list">
          {items.map((it) => {
            const t = progress.patches[it.key];
            const two = it.patch.faces === "both";
            const first = it.patch.cells[0];
            return (
              <div key={it.key} class={`patch-row ${it.key === selectedKey ? "sel" : ""}`}>
                <button class="link" aria-current={it.key === selectedKey ? "true" : undefined} onClick={() => setSelectedKey(it.key)}>
                  Patch {it.number}: {it.patch.cells.length} {it.patch.cells.length === 1 ? "square" : "squares"}, from round {first?.round}
                </button>
                <span class={`pill ${isDone(it) ? "done" : ""}`}>{isDone(it) ? "Done" : t?.outside || t?.inside ? "Half done" : "To do"}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
