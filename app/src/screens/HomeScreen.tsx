import { useRef, useState } from "preact/hooks";
import type { ChartError } from "@doubletake/core";
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
          <h3>Import a chart file</h3>
          <p class="small">Choose a Doubletake chart (.doubletake.json) or a backup you saved earlier. It stays on this device.</p>
          <input ref={input} id="import-file" class="sr-only" type="file" accept=".json,application/json" onChange={(e) => onFile((e.currentTarget as HTMLInputElement).files?.[0])} />
          <label class="btn block" for="import-file" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}>
            Choose a file
          </label>
        </div>
        <div class="card">
          <h3>Make a chart from a picture</h3>
          <p class="small">Choose a print or a picture. Doubletake finds the colours and turns it into a chart for the hat. The picture never leaves this device.</p>
          <a class="btn primary block" href="#/make">
            Choose a picture
          </a>
        </div>
        <div class="card">
          <h3>Make a chart with Claude</h3>
          <p class="small">Download a skill that lets Claude take you through the choices, then bring the chart file back here.</p>
          <a class="btn block" href="#/skill">
            Get the Claude skill
          </a>
        </div>
        <DrawCard />
      </section>
    </div>
  );
}
