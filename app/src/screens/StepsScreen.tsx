import type { Chart } from "@doubletake/core";
import { findAllPatches } from "@doubletake/core";
import { BLOCKING_TEXT, FINISHING_TEXT, HELP } from "../content";
import { allRoundsDone, currentRound, patchKey, patchesDone, percentComplete, toggleStep, TOTAL_ROUNDS } from "../lib/model";
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

export function StepsScreen({ chart, progress }: { chart: Chart; progress: Progress }) {
  const id = progress.projectId;
  const bodyDone = progress.completed >= 75;
  const crownDone = allRoundsDone(progress);
  const patchList = findAllPatches(chart).flatMap((layer, li) => layer.map((p) => ({ key: patchKey(li, p.index), faces: p.faces })));
  const dupDone = patchList.length > 0 && patchesDone(progress, patchList) === patchList.length;

  const steps: Step[] = [
    { id: "swatch", title: "Swatch and check gauge", manual: "swatch", state: progress.steps.swatch ? "done" : "todo", body: "Swatch in double knit stockinette and block it before you cast on. You want 25 stitch pairs and 34 rounds to 4 in (10 cm). Change needle size until you match." },
    { id: "caston", title: "Cast on 224 stitches", manual: "caston", state: progress.steps.caston ? "done" : "todo", help: "caston", body: "Use your two main colours and the alternating invisible cast on for double knitting in the round: 112 stitches of each colour, making 112 stitch pairs. Place a marker and join in the round, taking care not to twist." },
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
    </div>
  );
}
