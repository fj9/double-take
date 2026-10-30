import { useEffect, useMemo, useState } from "preact/hooks";
import { LAST_ROUND, PAIRS, pairsInRound, yarnsInRound } from "@doubletake/core";
import type { Chart } from "@doubletake/core";
import { Legend } from "../components/Legend";
import { StripChart } from "../components/StripChart";
import { FINISHING_TEXT, HELP, notesForRound } from "../content";
import type { Note } from "../content";
import { blocksFor, currentBlockIndex, pairAfterBlock, stepPair, wholeRoundText } from "../lib/blocks";
import type { ColourBlock } from "../lib/blocks";
import { coloursAreClose } from "../lib/marks";
import { allRoundsDone, canUndo, currentRound, markNoteSeen, nextRound, percentComplete, previousRound, setPair, undo } from "../lib/model";
import type { Progress } from "../lib/model";
import type { ChartView } from "../lib/render";
import { standing as paceStanding, todayIso } from "../lib/pace";
import {
  blocksHelpSeen,
  colourBlocks,
  highContrast,
  isDark,
  keepAwake,
  marks,
  setBlocksHelpSeen,
  setColourBlocks,
  setHighContrast,
  setMarks,
  setShowDuplicate,
  showDuplicate,
  zoom,
  zoomBy,
} from "../lib/settings";
import { progressById, saveProgress, toast } from "../store";

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

/** True while the phone is on its side, where height is scarce and fewer rounds fit. */
function useShortLandscape(): boolean {
  const query = "(orientation: landscape) and (max-height: 500px)";
  const [on, setOn] = useState(() => typeof matchMedia === "function" && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia(query);
    const change = () => setOn(mq.matches);
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, []);
  return on;
}

function BlockChip({ block, big }: { block: ColourBlock; big?: boolean }) {
  return (
    <span class={`block-chip ${big ? "big" : ""}`}>
      <span class="swatch sm" style={`background:${block.hex}`} aria-hidden="true" />
      <span>
        {block.name}
        {block.decrease ? " decrease" : ""} <span class="num">×{block.count}</span>
        <span class="muted small"> ({block.yarn})</span>
      </span>
    </span>
  );
}

/** One line per note; tap to read it. A note not yet opened has a dot. */
function NoteBanner({ note, seen, onOpen }: { note: Note; seen: boolean; onOpen: () => void }) {
  return (
    <details
      class="note-banner"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open && !seen) onOpen();
      }}
    >
      <summary>
        <div>
          <h3>{note.title}</h3>
          {note.caveat && <p class="small caveat">{note.caveat}</p>}
        </div>
        {!seen && (
          <span class="dot">
            <span class="sr-only">New</span>
          </span>
        )}
      </summary>
      <p style="margin:8px 0 0">{note.body}</p>
      {note.help && HELP[note.help] && (
        <p class="small" style="margin:8px 0 0">
          <a href={HELP[note.help] as string} target="_blank" rel="noreferrer">
            Watch the tutorial
          </a>
        </p>
      )}
    </details>
  );
}

function ViewPanel({ forced }: { forced: boolean }) {
  return (
    <div class="card view-panel">
      <div class="stack">
        <div class="row" style="flex-wrap:wrap">
          <span id="size-label">Chart size</span>
          <div class="seg" role="group" aria-labelledby="size-label">
            <button onClick={() => zoomBy(-1)}>Smaller</button>
            <button onClick={() => zoomBy(1)}>Larger</button>
          </div>
        </div>
        <div>
          <div id="marks-label" class="small muted">
            Letters in the squares
          </div>
          <div class="seg" role="group" aria-labelledby="marks-label">
            <button aria-pressed={marks.value === "none" && !forced} onClick={() => setMarks("none")} disabled={forced}>
              Off
            </button>
            <button aria-pressed={marks.value === "letters" || forced} onClick={() => setMarks("letters")}>
              On
            </button>
          </div>
          {forced && <p class="small muted" style="margin:6px 0 0">On because your two colours are close.</p>}
          <p class="small muted" style="margin:6px 0 0">The mark for a decrease always shows.</p>
        </div>
        <label class="check">
          <input type="checkbox" checked={colourBlocks.value} onChange={(e) => setColourBlocks((e.currentTarget as HTMLInputElement).checked)} />
          Colour blocks and the Next block button
        </label>
        <label class="check">
          <input type="checkbox" checked={showDuplicate.value} onChange={(e) => setShowDuplicate((e.currentTarget as HTMLInputElement).checked)} />
          Show duplicate stitch dots
        </label>
        <label class="check">
          <input type="checkbox" checked={highContrast.value} onChange={(e) => setHighContrast((e.currentTarget as HTMLInputElement).checked)} />
          High-contrast charts
        </label>
      </div>
    </div>
  );
}

export function RoundScreen({ chart, progress }: { chart: Chart; progress: Progress }) {
  useWakeLock(keepAwake.value);
  const shortLandscape = useShortLandscape();
  const done = allRoundsDone(progress);
  const round = currentRound(progress);
  const window_ = shortLandscape ? 4 : 7; // rounds shown above and below the current round
  const rows = Array.from({ length: Math.min(LAST_ROUND, round + window_) - Math.max(1, round - window_) + 1 }, (_, i) => Math.min(LAST_ROUND, round + window_) - i);
  const cols = useMemo(() => Array.from({ length: PAIRS }, (_, i) => PAIRS - i), []); // pair 1 at the right
  const pairs = pairsInRound(round);
  const set = (p: Progress) => saveProgress(p);
  const notes = notesForRound(round, chart);
  const stripes = chart.mode === "stripes";
  const pairNow = stripes ? yarnsInRound(chart, round) : null;
  const forced = coloursAreClose(chart);
  const letters = marks.value === "letters" || forced;
  const blocksOn = colourBlocks.value;

  const blocks = useMemo(() => blocksFor(chart, round), [chart, round]);
  const at = currentBlockIndex(blocks, progress.pair);
  const now = at >= 0 ? (blocks[at] as ColourBlock) : null;
  const then = at >= 0 ? (blocks[at + 1] ?? null) : null;
  const after = stepPair(chart, round, progress.pair, 1);

  const [viewOpen, setViewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(() => !blocksHelpSeen.value);
  useEffect(() => {
    if (!blocksHelpSeen.value) setBlocksHelpSeen();
  }, []);
  const [goto, setGoto] = useState("");
  const [gotoError, setGotoError] = useState<string | null>(null);

  const finishRound = () => {
    const finished = round;
    const next = nextRound(progress);
    set(next);
    toast.value = {
      message: `Round ${finished} done`,
      actionLabel: "Undo",
      actionName: `Undo round ${finished}`,
      duration: 6000,
      lift: true,
      onAction: () => {
        const cur = progressById.value[progress.projectId];
        if (cur && cur.completed === next.completed) set(undo(cur));
      },
    };
  };

  const goToPair = () => {
    const n = Number(goto);
    if (!Number.isInteger(n) || n < 1 || n > PAIRS) {
      setGotoError(`Enter a pair from 1 to ${PAIRS}.`);
      return;
    }
    const target = stepPair(chart, round, n - 1 === 0 ? null : n - 1, 1);
    if (target === null || target === (n - 1 === 0 ? null : n - 1)) {
      setGotoError(`There are no pairs left from ${n} on in this round.`);
      return;
    }
    setGotoError(target === n ? null : `Pair ${n} has been decreased away in this round, so you’re at pair ${target}.`);
    set(setPair(progress, target));
    setGoto("");
  };

  const view: ChartView = {
    chart,
    cols,
    rows,
    cellW: zoom.value,
    current: round,
    marker: progress.pair,
    showDuplicate: showDuplicate.value,
    inside: false,
    highContrast: highContrast.value,
    dark: isDark(),
    stripes,
    letters,
    gutter: true,
    divider: true,
  };
  const text = wholeRoundText(chart, round);
  const seen = new Set(progress.notesSeen ?? []);
  const patchCount = chart.duplicate.length > 0;

  return (
    <div class="round-layout">
      <div class="rl-wide">
        <div class="round-head">
          <div class="big">{done ? `Round ${LAST_ROUND} done` : `Round ${round} of ${LAST_ROUND}`}</div>
          <button class="btn small" aria-expanded={viewOpen} onClick={() => setViewOpen(!viewOpen)}>
            View
          </button>
        </div>
        <p class="small muted" style="margin:2px 0 6px">
          {done ? "All rounds done" : round >= 76 ? "Crown" : "Body"} · {percentComplete(progress)}% · {LAST_ROUND - progress.completed} rounds to go ·{" "}
          <span class="num" aria-label={`${pairs} stitch pairs, ${pairs * 2} needle stitches${round >= 76 ? " at the end of this round" : ""}`}>
            {round >= 76 ? `Ends with ${pairs} pairs (${pairs * 2} stitches)` : `${pairs} pairs · ${pairs * 2} stitches`}
          </span>
        </p>
        <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentComplete(progress)} aria-label="Rounds finished" style="margin:0 0 8px">
          <div style={`width:${percentComplete(progress)}%`} />
        </div>
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
      </div>

      {viewOpen && <ViewPanel forced={forced} />}

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
        <NoteBanner key={n.id} note={n} seen={seen.has(n.id)} onOpen={() => set(markNoteSeen(progress, n.id))} />
      ))}

      {blocksOn && !done && (
        <div class="card now" aria-live="polite">
          <div class="row between">
            <span class="small muted">Now</span>
            <button class="hint" aria-expanded={helpOpen} aria-label="What is a colour block?" onClick={() => setHelpOpen(!helpOpen)}>
              <span class="q" aria-hidden="true">
                ?
              </span>
            </button>
          </div>
          {now ? (
            <div class="now-row">
              <BlockChip block={now} big />
              {then && (
                <span class="then">
                  <span class="small muted">then </span>
                  <BlockChip block={then} />
                </span>
              )}
            </div>
          ) : (
            <p style="margin:4px 0 0">This round’s colour blocks are all worked. Press “Round {round} done” when you’ve finished it.</p>
          )}
          {helpOpen && (
            <p class="small" style="margin:10px 0 0">
              A colour block is a stretch of pairs in the same colour. Press <strong>Next block</strong> when you’ve worked it, and Doubletake moves your place along.
            </p>
          )}
        </div>
      )}

      <div class="strip-wrap">
        <section class="chart-box" aria-label={`Round ${round}, pairs 1 to ${PAIRS}`}>
          <StripChart
            view={view}
            label={`Round ${round} with the rounds around it, pairs 1 to ${PAIRS}. Stitch 1 is at the right. A text version is below.`}
            focusPair={progress.pair}
            focusKey={round}
            onPinch={zoomBy}
            onCell={(cell) => {
              if (cell.round === round) set(setPair(progress, progress.pair === cell.pair ? null : cell.pair));
            }}
          />
        </section>
        <p class="small muted" style="margin:0 0 8px">
          Read right to left. Tap a square to mark where you are.
          {patchCount && !showDuplicate.value && ` ${chart.duplicate.length === 1 ? "There is duplicate stitch" : "There are duplicate stitch colours"} to do after blocking (see the Stitch tab).`}
        </p>
      </div>

      <div class="card">
        <div class="row between" style="flex-wrap:wrap">
          <span>
            {progress.pair === null ? (
              "Put the work down mid-round? Mark where you are."
            ) : (
              <span>
                You’re at pair <span class="num">{progress.pair}</span> of {PAIRS}
                {progress.pair === 56 ? " (the end of Chart A)" : ""}
              </span>
            )}
          </span>
          <span class="seg" role="group" aria-label="Position in the round">
            <button aria-label="Back one pair" disabled={progress.pair === null} onClick={() => set(setPair(progress, stepPair(chart, round, progress.pair, -1)))}>
              −
            </button>
            <button aria-label="Forward one pair" disabled={after === progress.pair} onClick={() => set(setPair(progress, after))}>
              +
            </button>
            <button aria-label="Clear the position" disabled={progress.pair === null} onClick={() => set(setPair(progress, null))}>
              Clear
            </button>
          </span>
        </div>
        <form
          class="row goto"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            goToPair();
          }}
        >
          <label class="small muted" for="goto-pair">
            Go to pair
          </label>
          <input id="goto-pair" class="input" type="number" inputMode="numeric" min={1} max={PAIRS} value={goto} onInput={(e) => {
              setGoto((e.currentTarget as HTMLInputElement).value);
              setGotoError(null);
            }}
          />
          <button class="btn small" type="submit">
            Go
          </button>
        </form>
        {gotoError && (
          <p class="small" role="status" style="margin:6px 0 0">
            {gotoError}
          </p>
        )}
      </div>

      <Legend chart={chart} showDecrease={round >= 76} />

      <details class="card">
        <summary class="small" style="min-height:44px;display:flex;align-items:center;cursor:pointer">
          This round as text
        </summary>
        <p class="small">
          <strong>{text.heading}:</strong> {text.runs}
        </p>
        <p class="small muted">Worked right to left, starting at pair 1. A blank square on the chart has no stitch.</p>
      </details>

      <div class="controls">
        <div class="aux">
          <button class="btn small" disabled={progress.completed <= 0} onClick={() => set(previousRound(progress))}>
            Back a round
          </button>
          <button class="btn small" disabled={!canUndo(progress)} onClick={() => set(undo(progress))}>
            Undo
          </button>
        </div>
        <div class={`main ${blocksOn ? "two" : ""}`}>
          {blocksOn && (
            <button
              class="btn next-block"
              disabled={done || at < 0}
              onClick={() => {
                const to = pairAfterBlock(blocks, progress.pair);
                if (to !== null) set(setPair(progress, to));
              }}
            >
              Next block
            </button>
          )}
          <button class="btn primary next" disabled={done} onClick={finishRound}>
            {done ? "All rounds done" : `Round ${round} done, next`}
          </button>
        </div>
      </div>
    </div>
  );
}
