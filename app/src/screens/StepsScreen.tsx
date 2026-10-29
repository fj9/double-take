import { useState } from "preact/hooks";
import type { Chart } from "@doubletake/core";
import { findAllPatches } from "@doubletake/core";
import { BLOCKING_TEXT, FINISHING_TEXT, HASHTAG, HELP } from "../content";
import { allRoundsDone, currentRound, patchKey, patchesDone, percentComplete, setPace, toggleStep, TOTAL_ROUNDS } from "../lib/model";
import { formatDate, plan, standing, todayIso, validPace } from "../lib/pace";
import type { Pace } from "../lib/pace";
import type { ManualStep, Progress } from "../lib/model";
import { saveProgress } from "../store";

type State = "done" | "now" | "todo";

interface Step {
  id: string;
  title: string;
  state: State;
  body: string;
  help?: keyof typeof HELP;
  manual?: ManualStep;
  link?: { href: string; label: string };
  detail?: string;
}

function PacePlanner({ progress }: { progress: Progress }) {
  const pace = progress.pace;
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(pace?.start ?? todayIso());
  const [days, setDays] = useState(String(pace?.days ?? 14));
  const draft: Pace = { start, days: Number(days) };
  const ok = validPace(draft);
  const today = todayIso();

  if (!pace || editing) {
    return (
      <section class="card" aria-labelledby="pace">
        <h2 id="pace">Pace planner</h2>
        <p class="small muted">Spread the rounds over the days you have. It is only a guide, and it stays on this device.</p>
        <div class="grid2">
          <label class="field">
            <span class="small muted">Start date</span>
            <input class="input" type="date" value={start} onInput={(e) => setStart((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <label class="field">
            <span class="small muted">Number of days</span>
            <input class="input" type="number" min={1} max={365} value={days} onInput={(e) => setDays((e.currentTarget as HTMLInputElement).value)} />
          </label>
        </div>
        {!ok && <p class="small" style="color:var(--error)">Choose a start date and a number of days from 1 to 365.</p>}
        <div class="row" style="flex-wrap:wrap">
          <button
            class="btn primary"
            disabled={!ok}
            onClick={() => {
              saveProgress(setPace(progress, draft));
              setEditing(false);
            }}
          >
            {pace ? "Save the plan" : "Make a plan"}
          </button>
          {pace && (
            <button class="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
        </div>
      </section>
    );
  }

  const days_ = plan(pace);
  const st = standing(pace, progress.completed, today);
  return (
    <section class="card" aria-labelledby="pace">
      <h2 id="pace">Pace planner</h2>
      <p style="margin:0 0 8px">
        <strong>{pace.days} days from {formatDate(pace.start)}</strong>
      </p>
      <p class="small" style="margin:0 0 8px">{st.text}</p>
      <details>
        <summary class="summary">All {pace.days} days</summary>
        <div class="list">
          {days_.map((d) => {
            const isToday = d.date === today;
            const done = d.to >= d.from && progress.completed >= d.to;
            return (
              <div key={d.day} class="row between" style={isToday ? "background:var(--wash);box-shadow:inset 4px 0 0 var(--coral);padding-left:12px" : ""}>
                <span>
                  <span class="num">Day {d.day}</span> · {formatDate(d.date)}
                  <br />
                  <span class="small muted">{d.to < d.from ? "no rounds" : d.from === d.to ? `round ${d.from}` : `rounds ${d.from}–${d.to}`}</span>
                </span>
                {isToday ? <span class="pill">Today</span> : done ? <span class="pill done">Done</span> : null}
              </div>
            );
          })}
        </div>
      </details>
      <div class="row" style="flex-wrap:wrap;margin-top:12px">
        <button class="btn small" onClick={() => setEditing(true)}>
          Change the plan
        </button>
        <button class="btn small" onClick={() => saveProgress(setPace(progress, undefined))}>
          Remove the plan
        </button>
      </div>
    </section>
  );
}

export function StepsScreen({ chart, progress }: { chart: Chart; progress: Progress }) {
  const id = progress.projectId;
  const bodyDone = progress.completed >= 75;
  const crownDone = allRoundsDone(progress);
  const patchList = findAllPatches(chart).flatMap((layer, li) => layer.map((p) => ({ key: patchKey(li, p.index), faces: p.faces })));
  const dupDone = patchList.length > 0 && patchesDone(progress, patchList) === patchList.length;

  const steps: Step[] = [
    { id: "swatch", title: "Swatch and check gauge", manual: "swatch", state: progress.steps.swatch ? "done" : "todo", body: "Swatch in double knit stockinette and block it before you cast on. You want 25 stitch pairs and 34 rounds to 4 in (10 cm). Change needle size until you match." },
    { id: "caston", title: "Cast on 224 stitches", manual: "caston", state: progress.steps.caston ? "done" : "todo", help: "caston", body: chart.mode === "stripes" ? `Use the two colours for round 1 (${(chart.round_pairs?.[0] ?? []).map((id) => chart.yarns.find((y) => y.id === id)?.name ?? id).join(" and ")}) and the alternating invisible cast on for double knitting in the round: 112 stitches of each colour, making 112 stitch pairs. Place a marker and join in the round, taking care not to twist.` : "Use your two main colours and the alternating invisible cast on for double knitting in the round: 112 stitches of each colour, making 112 stitch pairs. Place a marker and join in the round, taking care not to twist." },
    { id: "body", title: "Body, rounds 1–75", state: bodyDone ? "done" : "todo", body: "Work Chart A then Chart B for each round. Knit the front stitch in the colour shown, then purl the back stitch in the other colour. Slip the marker at the start of every round.", help: "doubleknit", link: { href: `#/p/${id}/round`, label: "Open the round view" }, detail: bodyDone ? "All 75 body rounds done" : `${Math.min(progress.completed, 75)} of 75 rounds done` },
    { id: "crown", title: "Crown, rounds 76–95", state: crownDone ? "done" : "todo", body: "The crown decreases in eight identical wedges. A square marked / is a right-leaning decrease, worked over that pair and the pair just before it.", help: "decrease", link: { href: `#/p/${id}/round`, label: "Open the round view" }, detail: crownDone ? "All 20 crown rounds done" : `${Math.max(0, Math.min(progress.completed, 95) - 75)} of 20 rounds done` },
    { id: "finish", title: "Finish the crown", manual: "finish", state: progress.steps.finish ? "done" : "todo", body: FINISHING_TEXT },
    { id: "block", title: "Block", manual: "block", state: progress.steps.block ? "done" : "todo", body: BLOCKING_TEXT },
  ];
  if (patchList.length > 0) {
    steps.push({ id: "duplicate", title: "Duplicate stitch", state: dupDone ? "done" : "todo", body: "Work this after blocking. Cover each patch on both faces, one patch at a time.", help: "duplicate", link: { href: `#/p/${id}/duplicate`, label: "Open the duplicate stitch tracker" }, detail: `${patchesDone(progress, patchList)} of ${patchList.length} patches done` });
  }
  const firstTodo = steps.findIndex((s) => s.state !== "done");
  steps.forEach((s, i) => {
    if (i === firstTodo) s.state = "now";
  });

  return (
    <div>
      <h1>Steps</h1>
      <p class="muted">
        Round {currentRound(progress)} of {TOTAL_ROUNDS} · {percentComplete(progress)}% of the rounds done
      </p>
      <div class="progress" style="margin-bottom:16px">
        <div style={`width:${percentComplete(progress)}%`} />
      </div>
      <PacePlanner progress={progress} />
      {steps.map((s, i) => (
        <section class="card" key={s.id} aria-labelledby={`step-${s.id}`} style={s.state === "now" ? "border-color:var(--coral);border-width:2px" : ""}>
          <div class="row between">
            <h2 id={`step-${s.id}`} style="margin:0">
              {i + 1}. {s.title}
            </h2>
            <span class={`pill ${s.state === "done" ? "done" : ""}`}>{s.state === "done" ? "Done" : s.state === "now" ? "Up next" : "To do"}</span>
          </div>
          <p style="margin:8px 0">{s.body}</p>
          {s.detail && <p class="small muted num">{s.detail}</p>}
          <div class="row" style="flex-wrap:wrap">
            {s.manual && (
              <button class="btn small" aria-pressed={!!progress.steps[s.manual]} onClick={() => saveProgress(toggleStep(progress, s.manual as ManualStep))}>
                {progress.steps[s.manual] ? "Mark as not done" : "Mark as done"}
              </button>
            )}
            {s.link && (
              <a class="btn small" href={s.link.href}>
                {s.link.label}
              </a>
            )}
            {s.help && HELP[s.help] && (
              <a href={HELP[s.help] as string} target="_blank" rel="noreferrer">
                Watch the tutorial
              </a>
            )}
          </div>
        </section>
      ))}
      {allRoundsDone(progress) && HASHTAG && (
        <section class="card note" aria-labelledby="share">
          <h2 id="share">Share your hat</h2>
          <p style="margin:0">Finished, or nearly? Share a photo of both sides with {HASHTAG}. We’d love to see it.</p>
        </section>
      )}
    </div>
  );
}
