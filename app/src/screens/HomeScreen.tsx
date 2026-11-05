import { useRef, useState } from "preact/hooks";
import type { ChartError } from "@doubletake/core";
import { Flat } from "../components/Flat";
import { currentRound, newProgress, percentComplete, TOTAL_ROUNDS } from "../lib/model";
import type { Progress, Project } from "../lib/model";
import { backupHat } from "../lib/backups";
import { readFile } from "../lib/files";
import { EXAMPLES, createDrawProject, createProject, importText, progressById, projects, ready, removeProject, renameProject, toast } from "../store";

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

function DrawPanel() {
  const [colours, setColours] = useState(2);
  const [striped, setStriped] = useState(false);
  return (
    <div class="card start-panel">
      <h2 id="draw-colours" style="margin:0 0 6px;font-size:16px">
        How many colours?
      </h2>
      <div class="seg" role="group" aria-labelledby="draw-colours">
        {[2, 3, 4, 5, 6].map((n) => (
          <button key={n} aria-pressed={colours === n} onClick={() => setColours(n)}>
            {n}
          </button>
        ))}
      </div>
      <h2 id="draw-how" style="margin:12px 0 6px;font-size:16px">
        How is it knitted?
      </h2>
      <div class="seg" role="group" aria-labelledby="draw-how">
        <button aria-pressed={!striped} onClick={() => setStriped(false)}>
          A print
        </button>
        <button aria-pressed={striped} onClick={() => setStriped(true)}>
          Stripes
        </button>
      </div>
      <p class="small muted" style="margin:6px 0 12px">
        {striped ? "Each round uses two of your colours, and you choose which as you go up. A third is added with duplicate stitch." : "Two colours are knitted. Any more are added afterwards with duplicate stitch."}
      </p>
      <button
        class="btn primary block"
        onClick={async () => {
          const project = await createDrawProject({ name: "Colour A", hex: "#6b2d9e" }, { name: "Colour B", hex: "#f07eb5" }, "My hat", colours, striped);
          location.hash = `#/p/${project.id}/draw`;
        }}
      >
        Start drawing
      </button>
    </div>
  );
}

const ICONS = {
  paw: "M14.7 13.5c-1.1-2-1.4-2.5-2.7-2.5s-1.7.8-2.8 2.7c-.9 1.7-2.8 1.8-3.3 3.3-.1.3-.1.7-.1 1 0 1.200.8 2 1.800 2 1.300 0 3-1 4.500-1s3.200 1 4.500 1c1 0 1.800-.8 1.800-2 0-.3 0-.7-.1-1-.5-1.500-2.500-1.800-3.500-3.500zM20.200 8.100a1 1 0 00-.4-.1c-.7 0-1.600.8-2 1.900-.5 1.300-.3 2.700.5 3 .1.100.3.100.4.100.7 0 1.600-.7 2-1.900.5-1.300.3-2.700-.5-3zM9.500 9c.9-.1 1.500-1.300 1.300-2.700C10.600 5 9.800 4 8.900 4c-.9.100-1.500 1.300-1.300 2.700C7.800 8 8.600 9 9.500 9zM16.500 9c.9 0 1.700-1 1.900-2.300.2-1.400-.4-2.600-1.300-2.700-.9 0-1.700 1-1.900 2.300-.2 1.400.4 2.600 1.300 2.700zM4.200 11.500c.4.200.5.200.7.200.7 0 1.600-.7 2-1.900.5-1.300.3-2.700-.5-3a1 1 0 00-.3-.1c-.7 0-1.600.7-2 1.900-.5 1.300-.3 2.700.5 3z",
  photo: "M15 8h.01M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3zM3 16l5-5c.9-.9 2.100-.9 3 0l5 5M14 14l1-1c.9-.9 2.100-.9 3 0l3 3",
  pencil: "M4 20h4L18.500 9.500a2.800 2.800 0 10-4-4L4 16v4zM13.500 6.500l4 4",
};

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const dateOf = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function HatRow({ project: p, progress: pr, samename, onOpen }: { project: Project; progress: Progress | undefined; samename: boolean; onOpen: () => void }) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(p.name);
  const status = p.stage === "design" ? "Being designed" : pr ? (pr.completed >= TOTAL_ROUNDS ? "All rounds done" : `Round ${currentRound(pr)} of ${TOTAL_ROUNDS} · ${percentComplete(pr)}%`) : "";
  return (
    <div class="card hat-row">
      <div class="hat-thumb">
        <Flat chart={p.chart} bodyOnly picture label="" />
      </div>
      <div class="hat-info">
        <div class="row between" style="align-items:flex-start;flex-wrap:wrap">
          <div style="min-width:140px">
            <h3 style="margin:0">{p.name}</h3>
            {samename && <p class="small muted" style="margin:2px 0 0">Started {dateOf(p.createdAt)}</p>}
            <p class="small muted num" style="margin:4px 0 0">{status}</p>
            <p class="small muted" style="margin:0">Last opened {dateOf(pr?.updatedAt ?? p.updatedAt)}</p>
          </div>
          <div class="row">
            <button class="btn primary" onClick={onOpen} aria-label={`Open ${p.name}`}>
              Open
            </button>
            <button class="btn" aria-expanded={menu} aria-label={`Options for ${p.name}`} onClick={() => setMenu(!menu)}>
              ⋯
            </button>
          </div>
        </div>
        {menu && !renaming && !confirming && (
          <div class="row" style="flex-wrap:wrap;margin-top:8px">
            <button class="btn small" onClick={() => setRenaming(true)}>
              Rename
            </button>
            <button
              class="btn small"
              onClick={async () => {
                await createProject(structuredClone(p.chart), `${p.name} (copy)`, p.stage);
                setMenu(false);
              }}
            >
              Make a copy
            </button>
            <button
              class="btn small"
              onClick={() => {
                backupHat(p, pr ?? newProgress(p.id));
                setMenu(false);
                toast.value = { message: "Backup saved. Keep the file somewhere safe." };
              }}
            >
              Back up
            </button>
            <button class="btn small danger" onClick={() => setConfirming(true)}>
              Remove…
            </button>
          </div>
        )}
        {renaming && (
          <div class="row" style="margin-top:8px">
            <input class="input" aria-label={`New name for ${p.name}`} value={name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
            <button
              class="btn small primary"
              disabled={!name.trim()}
              onClick={async () => {
                await renameProject(p.id, name);
                setRenaming(false);
                setMenu(false);
              }}
            >
              Save the name
            </button>
            <button class="btn small" onClick={() => setRenaming(false)}>
              Cancel
            </button>
          </div>
        )}
        {confirming && (
          <div role="alertdialog" aria-label={`Remove ${p.name}`} style="margin-top:8px">
            <p class="small" style="margin:0 0 8px">
              This removes <strong>{p.name}</strong>{pr ? ` and your progress (${pr.completed} of ${TOTAL_ROUNDS} rounds done)` : ""} from this device. If you haven’t backed it up, it can’t be brought back.
            </p>
            <div class="row" style="flex-wrap:wrap">
              <button class="btn small danger" onClick={() => removeProject(p.id)}>
                Remove it
              </button>
              <button class="btn small" onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function HomeScreen() {
  const [errors, setErrors] = useState<ChartError[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<"example" | "draw" | null>(null);

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
      <h1>What would you like to knit?</h1>
      <p class="muted">One print, both sides, opposite colours.</p>

      {errors && <ImportErrors errors={errors} onClose={() => setErrors(null)} />}

      <div class="start-tiles">
        <button class="tile" aria-expanded={panel === "example"} onClick={() => setPanel(panel === "example" ? null : "example")}>
          <span class="tile-pic ink">
            <Icon d={ICONS.paw} />
          </span>
          <span class="tile-name">Try an example</span>
          <span class="tile-sub">Leopard or stripes</span>
        </button>
        <a class="tile" href="#/make">
          <span class="tile-pic coral">
            <Icon d={ICONS.photo} />
          </span>
          <span class="tile-name">From a picture</span>
          <span class="tile-sub">Photo, print or sample</span>
        </a>
        <button class="tile" aria-expanded={panel === "draw"} onClick={() => setPanel(panel === "draw" ? null : "draw")}>
          <span class="tile-pic wash">
            <Icon d={ICONS.pencil} />
          </span>
          <span class="tile-name">Draw it</span>
          <span class="tile-sub">Blank grid, you choose</span>
        </button>
      </div>

      {panel === "example" &&
        EXAMPLES.map((ex) => (
          <div class="card start-panel" key={ex.id}>
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
      {panel === "draw" && <DrawPanel />}

      <p class="open-file">
        <input ref={input} id="import-file" class="sr-only" aria-label="Choose a chart file" type="file" accept=".json,application/json" onChange={(e) => onFile((e.currentTarget as HTMLInputElement).files?.[0])} />
        <label for="import-file">Have a chart file or backup? Open it</label>
      </p>

      {continuing && (
        <section class="continue-card" aria-labelledby="continue">
          <div class="continue-pic">
            <Flat chart={continuing.chart} bodyOnly picture label="" />
          </div>
          <div>
            <h2 id="continue" style="margin:0;font-size:13px;font-weight:400" class="muted">
              Pick up where you left off
            </h2>
            <p style="margin:2px 0 0">
              <strong>{continuing.name}</strong>
            </p>
            <p class="small muted num" style="margin:0">
              Round {currentRound(continuingProgress as NonNullable<typeof continuingProgress>)}/{TOTAL_ROUNDS}
            </p>
            <div class="progress" style="margin:6px 0 10px">
              <div style={`width:${percentComplete(continuingProgress as NonNullable<typeof continuingProgress>)}%`} />
            </div>
            <button class="btn primary" onClick={() => open(continuing.id)}>
              Continue {continuing.name}
            </button>
          </div>
        </section>
      )}

      {ready.value && projects.value.length > 0 && (
        <section aria-labelledby="your-hats">
          <h2 id="your-hats" class="home-sec">
            Your hats
          </h2>
          {projects.value.map((p) => (
            <HatRow key={p.id} project={p} progress={progressById.value[p.id]} samename={projects.value.filter((o) => o.name === p.name).length > 1} onOpen={() => open(p.id)} />
          ))}
        </section>
      )}

      <p class="small muted" style="margin:16px 0 0">
        Want help from Claude? <a href="#/skill">Get the Claude skill</a>
      </p>
    </div>
  );
}
