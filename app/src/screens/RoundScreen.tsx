import { useEffect } from "preact/hooks";
import { CHART_A_LAST_PAIR, LAST_ROUND, pairsInRound, yarnsInRound } from "@doubletake/core";
import type { Chart } from "@doubletake/core";
import { ChartCanvas } from "../components/ChartCanvas";
import { Legend } from "../components/Legend";
import { FINISHING_TEXT, HELP, notesForRound } from "../content";
import { geometry, type ChartView } from "../lib/render";
import { allRoundsDone, canUndo, currentRound, nextRound, percentComplete, previousRound, setPair, undo } from "../lib/model";
import type { Progress } from "../lib/model";
import { highContrast, isDark, keepAwake, showDuplicate, zoom, zoomBy } from "../lib/settings";
import { standing as paceStanding, todayIso } from "../lib/pace";
import { roundText } from "../lib/text";
import { saveProgress } from "../store";

const WINDOW = 7; // rounds shown above and below the current round

function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* not allowed right now (for example, battery saver): carry on without it */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [enabled]);
}

export function RoundScreen({ chart, progress }: { chart: Chart; progress: Progress }) {
  useWakeLock(keepAwake.value);
  const done = allRoundsDone(progress);
  const round = currentRound(progress);
  const rows = Array.from({ length: Math.min(LAST_ROUND, round + WINDOW) - Math.max(1, round - WINDOW) + 1 }, (_, i) =>
    Math.min(LAST_ROUND, round + WINDOW) - i,
  );
  const pairs = pairsInRound(round);
  const set = (p: Progress) => saveProgress(p);
  const notes = notesForRound(round, chart);
  const stripes = chart.mode === "stripes";
  const pairNow = stripes ? yarnsInRound(chart, round) : null;

  const part = (which: "A" | "B") => {
    const lo = which === "A" ? 1 : CHART_A_LAST_PAIR + 1;
    const hi = which === "A" ? CHART_A_LAST_PAIR : 112;
    const cols = Array.from({ length: hi - lo + 1 }, (_, i) => hi - i); // stitch 1 at the right
    const marker = progress.pair !== null && progress.pair >= lo ? Math.min(progress.pair, hi) : null;
    const view: ChartView = {
      chart,
      cols,
      rows,
      cellW: zoom.value,
      current: round,
      marker,
      showDuplicate: showDuplicate.value,
      inside: false,
      highContrast: highContrast.value,
      dark: isDark(),
      stripes,
    };
    const g = geometry(view);
    const boundaryX = marker ? g.left + (hi - marker + 1) * g.cellW : undefined;
    const text = roundText(chart, round, which);
    return { lo, hi, view, boundaryX, text };
  };
  const A = part("A");
  const B = part("B");

  return (
    <div>
      <div class="round-head">
        <div>
          <div class="muted small">{done ? "All rounds done" : round >= 76 ? "Crown" : "Body"}</div>
          <div class="big">{done ? `Round ${LAST_ROUND} done` : `Round ${round} of ${LAST_ROUND}`}</div>
        </div>
        <div class="small muted num" aria-label={`${pairs} stitch pairs, ${pairs * 2} needle stitches${round >= 76 ? " at the end of this round" : ""}`}>
          {round >= 76 ? `Ends with ${pairs} pairs (${pairs * 2} stitches)` : `${pairs} pairs · ${pairs * 2} stitches`}
        </div>
      </div>
      <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentComplete(progress)} aria-label="Rounds finished" style="margin:8px 0 4px">
        <div style={`width:${percentComplete(progress)}%`} />
      </div>
      <p class="small muted">
        {percentComplete(progress)}% · {LAST_ROUND - progress.completed} rounds to go
      </p>
      {progress.pace && (
        <p class="small" style="margin:0 0 8px">
          <strong>Your plan:</strong> {paceStanding(progress.pace, progress.completed, todayIso()).text}
        </p>
      )}
      {pairNow && (
        <p class="small" style="margin:0 0 8px">
          <strong>Colours this round:</strong>{" "}
          {pairNow.map((id) => {
            const y = chart.yarns.find((yy) => yy.id === id);
            return (
              <span key={id} style="margin-right:12px;white-space:nowrap">
                <span class="swatch sm" style={`background:${y?.hex ?? "#ccc"}`} aria-hidden="true" />
                {y?.name ?? id} ({id})
              </span>
            );
          })}
        </p>
      )}

      {done && (
        <div class="card note">
          <h2>All 95 rounds are knitted</h2>
          <p>{FINISHING_TEXT}</p>
          <a class="btn" href={`#/p/${progress.projectId}/steps`}>
            See the finishing steps
          </a>
        </div>
      )}

      {notes.map((n) => (
        <div class="card note" key={n.id}>
          <h3>{n.title}</h3>
          <p style="margin:0">{n.body}</p>
          {n.help && HELP[n.help] && (
            <p class="small" style="margin:8px 0 0">
              <a href={HELP[n.help] as string} target="_blank" rel="noreferrer">
                Watch the tutorial
              </a>
            </p>
          )}
        </div>
      ))}

      <div class="row between" style="margin:8px 0">
        <div class="seg" role="group" aria-label="Zoom">
          <button aria-label="Zoom out" onClick={() => zoomBy(-1)}>
            −
          </button>
          <button aria-label="Zoom in" onClick={() => zoomBy(1)}>
            +
          </button>
        </div>
        <span class="small muted">Read right to left. Tap a square to mark where you are.</span>
      </div>

      {[A, B].map((p, i) => (
        <section class="chart-box" key={i} aria-label={p.text.heading}>
          <header>
            <h3 style="margin:0">{p.text.heading}</h3>
            <span class="small muted">{i === 0 ? "work this first" : "then this"}</span>
          </header>
          <ChartCanvas
            view={p.view}
            label={`${p.text.heading}, round ${round}, with the rounds around it. Stitch 1 is at the right. A text version is below.`}
            scrollTo={p.boundaryX ?? "start"}
            onPinch={zoomBy}
            onCell={(cell) => {
              if (cell.round === round) set(setPair(progress, progress.pair === cell.pair ? null : cell.pair));
            }}
          />
        </section>
      ))}

      <div class="card">
        <div class="row between">
          <span>
            {progress.pair === null ? (
              "Put the work down mid-round? Mark where you are."
            ) : (
              <span>
                You’re at pair <span class="num">{progress.pair}</span>
              </span>
            )}
          </span>
          <span class="seg" role="group" aria-label="Position in the round">
            <button aria-label="Back one pair" disabled={progress.pair === null} onClick={() => set(setPair(progress, progress.pair && progress.pair > 1 ? progress.pair - 1 : null))}>
              −
            </button>
            <button aria-label="Forward one pair" onClick={() => set(setPair(progress, Math.min(pairs, (progress.pair ?? 0) + 1)))}>
              +
            </button>
            <button aria-label="Clear the position" disabled={progress.pair === null} onClick={() => set(setPair(progress, null))}>
              Clear
            </button>
          </span>
        </div>
      </div>

      <Legend chart={chart} showDecrease={round >= 76} />

      <details class="card">
        <summary class="small" style="min-height:44px;display:flex;align-items:center;cursor:pointer">
          This round as text
        </summary>
        {[A, B].map((p) => (
          <p key={p.text.heading} class="small">
            <strong>{p.text.heading}:</strong> {p.text.runs}
          </p>
        ))}
        <p class="small muted">Worked right to left, starting at pair 1 of Chart A. A blank square on the chart has no stitch.</p>
      </details>

      <div class="controls">
        <button class="btn" disabled={progress.completed <= 0} onClick={() => set(previousRound(progress))} aria-label="Previous round">
          Previous
        </button>
        <button class="btn" disabled={!canUndo(progress)} onClick={() => set(undo(progress))}>
          Undo
        </button>
        <button class="btn primary next" disabled={done} onClick={() => set(nextRound(progress))}>
          {done ? "All rounds done" : `Round ${round} done, next`}
        </button>
      </div>
    </div>
  );
}
