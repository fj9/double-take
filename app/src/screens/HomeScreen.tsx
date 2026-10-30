import { useRef, useState } from "preact/hooks";
import type { ChartError } from "@doubletake/core";
import { Flat } from "../components/Flat";
import { currentRound, percentComplete, TOTAL_ROUNDS } from "../lib/model";
import { readFile } from "../lib/files";
import { EXAMPLES, createDrawProject, createProject, importText, progressById, projects, ready } from "../store";

export function ImportErrors({ errors, onClose }: { errors: ChartError[]; onClose: () => void }) {
  return (
    <div class="card" role="alert" style="border-color:var(--error)">
      <h2 style="color:var(--error)">That file can’t be used</h2>
      <p>Nothing has been changed. Here is what needs fixing:</p>
      <ul class="errors">
        {errors.slice(0, 8).map((e, i) => (
          <li key={i}>{e.message}</li>
        ))}
      </ul>
      {errors.length > 8 && <p class="small muted">…and {errors.length - 8} more.</p>}
      <button class="btn small" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

function DrawCard() {
  const [a, setA] = useState({ name: "Colour A", hex: "#6b2d9e" });
  const [b, setB] = useState({ name: "Colour B", hex: "#f07eb5" });
  const field = (label: string, v: { name: string; hex: string }, set: (v: { name: string; hex: string }) => void) => (
    <div class="row" style="flex-wrap:wrap;margin-bottom:12px">
      <input type="color" class="colour-input" aria-label={`${label} colour`} value={v.hex} onInput={(e) => set({ ...v, hex: (e.currentTarget as HTMLInputElement).value })} />
      <input class="input" style="flex:1;min-width:140px" aria-label={`${label} name`} value={v.name} onInput={(e) => set({ ...v, name: (e.currentTarget as HTMLInputElement).value })} />
    </div>
  );
  return (
    <div class="card">
      <h3>Draw your own chart</h3>
      <p class="small">Pick your two main yarn colours, then draw on the grid. The outside shows one colour and the inside shows the other.</p>
      {field("First yarn", a, setA)}
      {field("Second yarn", b, setB)}
      <button
        class="btn primary block"
        onClick={async () => {
          const project = await createDrawProject({ name: a.name.trim() || "Colour A", hex: a.hex }, { name: b.name.trim() || "Colour B", hex: b.hex });
          location.hash = `#/p/${project.id}/draw`;
        }}
      >
        Start drawing
      </button>
    </div>
  );
}

export function HomeScreen() {
  const [errors, setErrors] = useState<ChartError[] | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // The knit-stage hat worked on most recently
  const knitting = projects.value.filter((p) => p.stage !== "design" && progressById.value[p.id]);
  const continuing = knitting.reduce<(typeof knitting)[number] | null>((a, b) => (!a || (progressById.value[b.id]?.updatedAt ?? 0) > (progressById.value[a.id]?.updatedAt ?? 0) ? b : a), null);
  const continuingProgress = continuing ? progressById.value[continuing.id] : undefined;

  const open = (id: string) => {
    location.hash = `#/p/${id}/${projects.value.find((p) => p.id === id)?.stage === "design" ? "draw" : "round"}`;
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await readFile(file);
    const result = await importText(text);
    if (result.ok) {
      setErrors(null);
      open(result.project.id);
    } else {
      setErrors(result.errors);
    }
    if (input.current) input.current.value = "";
  };

  return (
    <div>
      <h1>Knit a reversible hat</h1>
      <p class="muted">The same print on both sides, in opposite colours. Doubletake keeps your place, round by round.</p>

      {errors && <ImportErrors errors={errors} onClose={() => setErrors(null)} />}

      {continuing && (
        <section class="card continue" aria-labelledby="continue">
          <div class="continue-pic">
            <Flat chart={continuing.chart} bodyOnly picture label="" />
          </div>
          <div>
            <h2 id="continue" style="margin:0">Continue</h2>
            <p style="margin:4px 0 0">
              <strong>{continuing.name}</strong>
            </p>
            <p class="small muted num" style="margin:0 0 12px">
              Round {currentRound(continuingProgress as NonNullable<typeof continuingProgress>)}/{TOTAL_ROUNDS} · {percentComplete(continuingProgress as NonNullable<typeof continuingProgress>)}%
            </p>
            <button class="btn primary" onClick={() => open(continuing.id)}>
              Continue {continuing.name}
            </button>
          </div>
        </section>
      )}

      {ready.value && projects.value.length > 0 && (
        <section aria-labelledby="your-hats">
          <h2 id="your-hats">Your hats</h2>
          {projects.value.map((p) => {
            const pr = progressById.value[p.id];
            return (
              <div class="card" key={p.id}>
                <div class="row between">
                  <div>
                    <h3 style="margin:0">{p.name}</h3>
                    {projects.value.filter((o) => o.name === p.name).length > 1 && <p class="small muted" style="margin:2px 0 0">Started {new Date(p.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</p>}
                    <p class="small muted num" style="margin:4px 0 0">
                      {p.stage === "design" ? "Being designed" : pr ? (pr.completed >= TOTAL_ROUNDS ? "All rounds done" : `Round ${currentRound(pr)} of ${TOTAL_ROUNDS}`) : ""}
                      {p.stage !== "design" && pr ? ` · ${percentComplete(pr)}%` : ""}
                    </p>
                  </div>
                  <button class="btn primary" onClick={() => open(p.id)} aria-label={`Open ${p.name}`}>
                    Open
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section aria-labelledby="start-new">
        <h2 id="start-new">Start a new hat</h2>
        <h3 style="margin:0 0 8px">Try an example</h3>
        {EXAMPLES.map((ex) => (
          <div class="card" key={ex.id}>
            <h3>{ex.title}</h3>
            <p class="small">{ex.blurb}</p>
            <button
              class="btn primary block"
              onClick={async () => {
                const project = await createProject(ex.build(), ex.title);
                open(project.id);
              }}
            >
              Use this chart
            </button>
          </div>
        ))}
        <div class="card">
          <h3>Make a chart from a picture</h3>
          <p class="small">Choose a print or a picture. Doubletake finds the colours and turns it into a chart for the hat. The picture never leaves this device.</p>
          <a class="btn primary block" href="#/make">
            Choose a picture
          </a>
        </div>
        <DrawCard />
        <div class="card">
          <h3>I have a chart file</h3>
          <p class="small">Choose a Doubletake chart (.doubletake.json) or a backup you saved earlier. It stays on this device.</p>
          <input ref={input} id="import-file" class="sr-only" aria-label="Choose a chart file" type="file" accept=".json,application/json" onChange={(e) => onFile((e.currentTarget as HTMLInputElement).files?.[0])} />
          <label class="btn block" for="import-file">
            Choose a file
          </label>
        </div>
        <p class="small muted" style="margin:8px 0 0">
          Want help from Claude? <a href="#/skill">Get the Claude skill</a>, which takes you through the choices and gives you a chart file to bring back here.
        </p>
      </section>
    </div>
  );
}
