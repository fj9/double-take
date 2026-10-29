import { useRef, useState } from "preact/hooks";
import { analyse, crownPrint, crownTable, validateChart, yarnsInRound } from "@doubletake/core";
import { ChartCanvas } from "../components/ChartCanvas";
import { allRoundsDone } from "../lib/model";
import type { Progress, Project } from "../lib/model";
import { useWidth } from "../lib/useWidth";
import type { ChartView } from "../lib/render";
import { isDark } from "../lib/settings";
import { createProject, flushChartSave, setStage } from "../store";

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

export function ReviewScreen({ project, progress }: { project: Project; progress: Progress }) {
  const chart = project.chart;
  const designing = project.stage === "design";
  const valid = validateChart(chart);
  const a = analyse(chart);
  const stop = a.warnings.some((w) => w.level === "stop");
  const [ack, setAck] = useState(false);
  const [face, setFace] = useState<"outside" | "inside">("outside");
  const [dots, setDots] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);

  const cellW = Math.max(2.5, (width - 40) / 112);
  const rows = Array.from({ length: 95 }, (_, i) => 95 - i);
  const cols = Array.from({ length: 112 }, (_, i) => (face === "outside" ? 112 - i : i + 1));
  const view: ChartView = { chart, cols, rows, cellW, showDuplicate: dots, inside: face === "inside", highContrast: false, dark: isDark() };

  const start = async () => {
    await flushChartSave();
    await setStage(project.id, "knit");
    location.hash = `#/p/${project.id}/round`;
  };
  const edit = async () => {
    await setStage(project.id, "design");
    location.hash = `#/p/${project.id}/draw`;
  };
  const copy = async () => {
    const p = await createProject(structuredClone(chart), `${project.name} (copy)`, "design");
    location.hash = `#/p/${p.id}/draw`;
  };

  const yarnLabel = (id: string) => chart.yarns.find((y) => y.id === id)?.name ?? id;
  const crownYarns = yarnsInRound(chart, 75).map(yarnLabel);
  const print = crownPrint(chart);

  return (
    <div>
      <h1>Review your chart</h1>
      <p class="muted">Check everything before you cast on. The chart is {project.name}.</p>

      {!valid.ok && (
        <div class="card" role="alert" style="border-color:var(--error)">
          <h2 style="color:var(--error)">This chart has a problem</h2>
          <ul class="errors">
            {valid.errors.slice(0, 5).map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      {a.warnings.map((w) => (
        <div key={w.code} class="card note" style={w.level === "stop" ? "border-color:var(--error)" : ""}>
          <h3 style={w.level === "stop" ? "color:var(--error)" : ""}>{w.level === "stop" ? "Please look at this" : "Worth knowing"}</h3>
          <p style="margin:0">{w.message}</p>
        </div>
      ))}

      <section class="card" aria-labelledby="hat-view">
        <h2 id="hat-view">The hat laid flat</h2>
        <div class="row" style="flex-wrap:wrap;margin-bottom:8px">
          <div class="seg" role="group" aria-label="Which face">
            <button aria-pressed={face === "outside"} onClick={() => setFace("outside")}>
              Outside
            </button>
            <button aria-pressed={face === "inside"} onClick={() => setFace("inside")}>
              Inside view
            </button>
          </div>
          {chart.duplicate.length > 0 && (
            <label class="check small">
              <input type="checkbox" checked={dots} onChange={(e) => setDots((e.currentTarget as HTMLInputElement).checked)} />
              Show duplicate stitch dots
            </label>
          )}
        </div>
        <div ref={box} class="chart-box" style="margin:0">
          <ChartCanvas view={view} label={`The whole hat laid flat, ${face} view, round 1 at the bottom and the crown at the top.`} />
        </div>
        <p class="small muted" style="margin:8px 0 0">
          {face === "outside" ? "Round 1 is at the bottom, stitch 1 at the right, as in the pattern." : "The inside is the same print in the other colours, as you see it looking at the inside of the hat."}
        </p>
      </section>

      <section class="card" aria-labelledby="yarns">
        <h2 id="yarns">Shopping list</h2>
        <div class="list">
          {chart.yarns.map((y) => (
            <div key={y.id} class="row between">
              <span>
                <span class="swatch sm" style={`background:${y.hex}`} aria-hidden="true" />
                <strong>{y.name}</strong> <span class="muted small">({y.id}, {y.role === "main" ? "main colour" : y.role === "stripe" ? "stripe colour" : "duplicate stitch"})</span>
              </span>
              <span class="small muted num">{y.role === "main" ? `${pct(a.outsideShare[y.id] ?? 0)} of the outside` : ""}</span>
            </div>
          ))}
        </div>
        <p class="small muted" style="margin:8px 0 0">Fingering (4-ply) weight yarn, 2.0 mm (US 0) needles, stitch markers and a blunt tapestry needle.</p>
      </section>

      <section class="card note" aria-labelledby="yardage">
        <h2 id="yardage">How much yarn?</h2>
        <p>
          <strong>Yardage isn’t calculated yet.</strong> The estimates will be added after sample knitting.
        </p>
        <p style="margin:0">
          Until then, <strong>buy more than you think you need and keep some spare.</strong> How much you use depends on your design, your tension and your yarn, and duplicate stitch uses the most extra.
        </p>
      </section>

      {a.duplicate.length > 0 && (
        <section class="card" aria-labelledby="dup">
          <h2 id="dup">Duplicate stitch</h2>
          <div class="list">
            {a.duplicate.map((d) => {
              const layer = chart.duplicate.find((l) => l.yarn === d.yarn);
              return (
                <div key={d.yarn}>
                  <strong>{yarnLabel(d.yarn)}</strong>: {d.patches} {d.patches === 1 ? "patch" : "patches"}, {d.cells} squares ({pct(d.share)} of the hat),{" "}
                  {layer?.faces === "outside" ? "outside only" : "outside and inside"}.
                </div>
              );
            })}
          </div>
          <p class="small muted" style="margin:8px 0 0">
            Worked after blocking, one patch at a time. The tracker keeps count of the patches for you.
          </p>
        </section>
      )}

      <section class="card" aria-labelledby="crown">
        <h2 id="crown">Crown</h2>
        <p>
          {print
            ? `The print carries on into the crown as far as round ${print.lastRound}. Above that the crown is ${crownYarns[0]} on the outside and ${crownYarns[1]} on the inside, with right-leaning decreases in eight wedges.`
            : `The crown is ${crownYarns[0]} on the outside and ${crownYarns[1]} on the inside${chart.mode === "stripes" ? ", in the top stripe’s colours" : ""}, with right-leaning decreases in eight wedges.`}
        </p>
        <details>
          <summary class="summary">The decrease table</summary>
          <p class="small">Right-leaning decreases in eight identical wedges of 14 pairs. Pairs left at the end of each round:</p>
          <table class="small" style="border-collapse:collapse;width:100%">
            <thead>
              <tr>
                <th style="text-align:left">Round</th>
                <th style="text-align:left">Pairs</th>
                <th style="text-align:left">Stitches</th>
              </tr>
            </thead>
            <tbody>
              {crownTable().map((r) => (
                <tr key={r.round} style="border-top:0.3mm dashed var(--line)">
                  <td>{r.round}</td>
                  <td class="num">{r.pairs}</td>
                  <td class="num">{r.pairs * 2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      {designing ? (
        <div class="stack">
          {stop && (
            <label class="check">
              <input type="checkbox" checked={ack} onChange={(e) => setAck((e.currentTarget as HTMLInputElement).checked)} />
              I’ve read the note about duplicate stitch and want to go ahead
            </label>
          )}
          <button class="btn primary block" disabled={!valid.ok || (stop && !ack)} onClick={start}>
            Looks good, start knitting
          </button>
          <a class="btn block" href={`#/p/${project.id}/draw`}>
            Back to drawing
          </a>
        </div>
      ) : (
        <div class="card">
          <h2>Changing this chart</h2>
          {allRoundsDone(progress) || progress.completed > 0 ? (
            <p class="small">You’ve started knitting this hat, so its chart is locked. To try changes, make an editable copy. Your progress here stays as it is.</p>
          ) : (
            <p class="small">You haven’t started knitting yet, so you can still change the chart.</p>
          )}
          <div class="row" style="flex-wrap:wrap">
            {progress.completed === 0 && (
              <button class="btn" onClick={edit}>
                Edit this chart
              </button>
            )}
            <button class="btn" onClick={copy}>
              Make an editable copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
