import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { analyse, buildChart, BuildError, compareRoutes, rgbToLab } from "@doubletake/core";
import type { Chart, Choice, PaletteCheck, Pixels, RoleResult } from "@doubletake/core";
import { ChartCanvas } from "../components/ChartCanvas";
import { DEFAULT_CROP, cropBox } from "../lib/crop";
import type { CropSettings } from "../lib/crop";
import { decodePicture } from "../lib/decode";
import { Generator } from "../lib/generator";
import type { ChartView } from "../lib/render";
import { isDark } from "../lib/settings";
import { useWidth } from "../lib/useWidth";
import { createProject } from "../store";

type Stage = "picture" | "colours" | "knit";
const hexOf = (c: number[]) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

function SourcePreview({ pixels, crop }: { pixels: Pixels; crop: CropSettings }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const source = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = pixels.width;
    c.height = pixels.height;
    c.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
    return c;
  }, [pixels]);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const scale = Math.min(1, 360 / pixels.width);
    const w = Math.round(pixels.width * scale);
    const h = Math.round(pixels.height * scale);
    c.width = w;
    c.height = h;
    ctx.drawImage(source, 0, 0, w, h);
    const b = cropBox(pixels.width, pixels.height, crop);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, b.x, b.y, b.width, b.height, b.x * scale, b.y * scale, b.width * scale, b.height * scale);
    ctx.strokeStyle = "#f26b5b";
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x * scale, b.y * scale, b.width * scale, b.height * scale);
  }, [source, crop, pixels]);
  return <canvas ref={ref} role="img" aria-label="Your picture with the part that will be used outlined" style="max-width:100%;border-radius:8px;display:block" />;
}

function Swatch({ hex, name, share }: { hex: string; name?: string; share?: number }) {
  return (
    <span style="display:inline-flex;align-items:center;margin-right:12px">
      <span class="swatch sm" style={`background:${hex}`} aria-hidden="true" />
      <span class="small">
        {name ? `${name} ` : ""}
        {share !== undefined ? <span class="muted">{pct(share)}</span> : <span class="muted">{hex}</span>}
      </span>
    </span>
  );
}

/** A chart laid flat, sized to fit its box. */
function Flat({ chart, inside, wrap, label }: { chart: Chart; inside?: boolean; wrap?: boolean; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const once = Array.from({ length: 112 }, (_, i) => (inside ? i + 1 : 112 - i));
  const cols = wrap ? [...once, ...once] : once;
  const cellW = Math.max(1.2, (width - 40) / cols.length);
  const view: ChartView = { chart, cols, rows: Array.from({ length: 95 }, (_, i) => 95 - i), cellW, showDuplicate: true, inside: !!inside, highContrast: false, dark: isDark() };
  return (
    <div ref={box} class="chart-box" style="margin:0;min-width:0;max-width:100%">
      <ChartCanvas view={view} label={label} />
    </div>
  );
}

export function MakeScreen() {
  const gen = useRef<Generator | null>(null);
  const getGen = () => (gen.current ??= new Generator());
  useEffect(() => () => gen.current?.stop(), []);

  const [stage, setStage] = useState<Stage>("picture");
  const [pic, setPic] = useState<{ pixels: Pixels; name: string } | null>(null);
  const [palette, setPalette] = useState<PaletteCheck | null>(null);
  const [crop, setCrop] = useState<CropSettings>(DEFAULT_CROP);
  const [colours, setColours] = useState(3);
  const [seam, setSeam] = useState<"fade" | "accept">("fade");
  const [minPatch, setMinPatch] = useState(3);
  const [roles, setRoles] = useState<RoleResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wrapView, setWrapView] = useState(false);

  const [dupRole, setDupRole] = useState<number | null>(null);
  const [swap, setSwap] = useState(false);
  const [route, setRoute] = useState<"A" | "B" | null>(null);
  const [crownVariant, setCrownVariant] = useState<"patterned" | "plain">("patterned");
  const [plainFrom, setPlainFrom] = useState(86);
  const [names, setNames] = useState<string[]>([]);
  const [hexes, setHexes] = useState<string[]>([]);
  const [hatName, setHatName] = useState("My hat");

  const seq = useRef(0);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy("Opening your picture…");
    try {
      const pixels = await decodePicture(file);
      const g = getGen();
      await g.load(pixels);
      const p = await g.palette();
      setPic({ pixels, name: file.name });
      setPalette(p);
      setHatName(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "My hat");
      const n = Math.max(2, Math.min(6, p.palette.length));
      const start = p.coverage < 0.7 ? Math.min(n, 3) : n;
      setColours(start);
      setSeam(start <= 3 ? "fade" : "accept");
      setMinPatch(start <= 3 ? 3 : 5);
      setCrop(DEFAULT_CROP);
      setRoles(null);
      setNames([]);
      setHexes([]);
      setDupRole(null);
      setSwap(false);
      setRoute(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t open that picture.");
    } finally {
      setBusy(null);
    }
  };

  // Work out the colours whenever the settings change, after a short pause
  useEffect(() => {
    if (!pic) return;
    const mine = ++seq.current;
    setBusy("Working on your picture…");
    const t = setTimeout(async () => {
      try {
        const r = await getGen().roles({ colours, seam, minPatch, crop: cropBox(pic.pixels.width, pic.pixels.height, crop) });
        if (mine !== seq.current) return;
        setRoles(r);
        setError(null);
      } catch (e) {
        if (mine === seq.current) setError(e instanceof Error ? e.message : "Couldn’t work out the colours.");
      } finally {
        if (mine === seq.current) setBusy(null);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [pic, crop, colours, seam, minPatch]);

  const comparison = useMemo(() => (roles && roles.centres.length > 3 ? compareRoutes(roles.grid) : null), [roles]);
  const chosenRoute = route ?? (comparison && comparison.recommend === "B" ? "B" : "A");

  const choice = (): Choice => {
    if (!roles) return { kind: "two" };
    const k = roles.centres.length;
    if (k === 2) return { kind: "two" };
    if (k === 3) {
      const d = dupRole ?? 2;
      const rest = [0, 1, 2].filter((r) => r !== d);
      return { kind: "duplicate", dupRoles: [d], outsideRole: swap ? (rest[1] as number) : (rest[0] as number) };
    }
    return chosenRoute === "B" ? { kind: "stripes" } : { kind: "duplicate" };
  };

  const buildOpts = { name: hatName, yarnNames: names, yarnHex: hexes, crown: { variant: crownVariant, plainFrom } };
  const built = useMemo(() => {
    if (!roles) return null;
    try {
      const chart = buildChart(roles, choice(), buildOpts);
      return { chart, analysis: analyse(chart), error: null as string | null };
    } catch (e) {
      return { chart: null, analysis: null, error: e instanceof BuildError ? e.message : "That choice can’t be made into a chart." };
    }
  }, [roles, dupRole, swap, chosenRoute, crownVariant, plainFrom, names, hexes, hatName]);

  // For three colours: all three ways to knit it, to compare
  const colourways = useMemo(() => {
    if (!roles || roles.centres.length !== 3) return [];
    return [0, 1, 2].map((d) => {
      const rest = [0, 1, 2].filter((r) => r !== d) as [number, number];
      const lab = (r: number) => rgbToLab(...(roles.centres[r] as [number, number, number]));
      const [a, b] = [lab(rest[0]), lab(rest[1])];
      const contrast = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      let chart: Chart | null = null;
      try {
        chart = buildChart(roles, { kind: "duplicate", dupRoles: [d], outsideRole: swap ? rest[1] : rest[0] }, buildOpts);
      } catch {
        chart = null;
      }
      return { d, chart, contrast };
    });
  }, [roles, swap, names, hexes, crownVariant, plainFrom, hatName]);
  const best = colourways.length ? colourways.reduce((a, b) => (b.contrast > a.contrast ? b : a)).d : null;

  const yarnName = (r: number) => names[r]?.trim() || `colour ${r + 1}`;
  const setName = (r: number, v: string) => {
    const next = [...names];
    next[r] = v;
    setNames(next);
  };
  const setHex = (r: number, v: string) => {
    const next = [...hexes];
    next[r] = v;
    setHexes(next);
  };

  const use = async () => {
    if (!built?.chart) return;
    const project = await createProject(built.chart, hatName.trim() || "My hat", "design");
    location.hash = `#/p/${project.id}/review`;
  };

  const steps: [Stage, string][] = [["picture", "Picture"], ["colours", "Colours"], ["knit", "Knit it"]];

  return (
    <div>
      <h1>Make a chart from a picture</h1>
      <ol class="steps" aria-label="Steps">
        {steps.map(([id, label], i) => (
          <li key={id} aria-current={stage === id ? "step" : undefined} class={stage === id ? "on" : ""}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      <p class="small muted">Your picture stays on this device. Nothing is uploaded.</p>

      {error && (
        <div class="card" role="alert" style="border-color:var(--error)">
          <p style="margin:0">{error}</p>
        </div>
      )}
      <div aria-live="polite" class="small muted" style="min-height:24px">
        {busy}
      </div>

      {stage === "picture" && (
        <div class="stack">
          <div class="card">
            <h2>Choose a picture</h2>
            <p class="small">A pattern, a print or a simple picture works best. Big flat areas of colour knit better than fine detail. Only use pictures you have the right to use.</p>
            <div class="row" style="flex-wrap:wrap">
              <input id="pic-file" class="sr-only" type="file" accept="image/*" onChange={(e) => choose((e.currentTarget as HTMLInputElement).files?.[0])} />
              <label class="btn primary" for="pic-file" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), document.getElementById("pic-file")?.click())}>
                {pic ? "Choose a different picture" : "Choose a picture"}
              </label>
              <input id="pic-cam" class="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => choose((e.currentTarget as HTMLInputElement).files?.[0])} />
              <label class="btn" for="pic-cam" tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), document.getElementById("pic-cam")?.click())}>
                Take a photo
              </label>
            </div>
          </div>

          {pic && palette && (
            <>
              <div class="card">
                <h2>What will be used</h2>
                <p class="small">The hat is about twice as wide as it is tall. Move and zoom the frame to choose the part of your picture to use.</p>
                <SourcePreview pixels={pic.pixels} crop={crop} />
                <div class="stack" style="margin-top:12px">
                  <label class="field">
                    <span class="small muted">Zoom</span>
                    <input class="range" type="range" min="1" max="4" step="0.1" value={crop.zoom} onInput={(e) => setCrop({ ...crop, zoom: Number((e.currentTarget as HTMLInputElement).value) })} />
                  </label>
                  <label class="field">
                    <span class="small muted">Left to right</span>
                    <input class="range" type="range" min="0" max="1" step="0.01" value={crop.cx} onInput={(e) => setCrop({ ...crop, cx: Number((e.currentTarget as HTMLInputElement).value) })} />
                  </label>
                  <label class="field">
                    <span class="small muted">Up and down</span>
                    <input class="range" type="range" min="0" max="1" step="0.01" value={crop.cy} onInput={(e) => setCrop({ ...crop, cy: Number((e.currentTarget as HTMLInputElement).value) })} />
                  </label>
                </div>
              </div>
              <div class="card" aria-labelledby="found">
                <h2 id="found">
                  {palette.palette.length} real {palette.palette.length === 1 ? "colour" : "colours"} found
                </h2>
                <p>
                  {palette.palette.map((c, i) => (
                    <Swatch key={i} hex={hexOf(c)} share={palette.shares[i] as number} />
                  ))}
                </p>
                {palette.warnings.map((w, i) => (
                  <p key={i} class="small muted" style="margin:0 0 6px">
                    {w}
                  </p>
                ))}
              </div>
              <button class="btn primary block" onClick={() => setStage("colours")}>
                Next: choose the colours
              </button>
            </>
          )}
        </div>
      )}

      {stage === "colours" && pic && palette && (
        <div class="stack">
          <div class="card">
            <h2>How many colours?</h2>
            <div class="seg" role="group" aria-label="Number of colours">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  aria-pressed={colours === n}
                  onClick={() => {
                    setColours(n);
                    setSeam(n <= 3 ? "fade" : "accept");
                    setMinPatch(n <= 3 ? 3 : 5);
                    setDupRole(null);
                    setRoute(null);
                    setNames([]);
                    setHexes([]);
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <p class="small muted" style="margin:8px 0 0">
              We found {palette.palette.length} real {palette.palette.length === 1 ? "colour" : "colours"}. Extra shades of one colour (shadows, pile) are not new colours, so use as few as the picture needs. Two knit in the hat, and the rest are worked in duplicate stitch or stripes.
            </p>
          </div>

          <div class="card">
            <h2>Joining up round the hat</h2>
            <div class="seg" role="group" aria-label="Seam">
              <button aria-pressed={seam === "fade"} onClick={() => setSeam("fade")}>
                Blend the join
              </button>
              <button aria-pressed={seam === "accept"} onClick={() => setSeam("accept")}>
                Leave the join
              </button>
            </div>
            <p class="small muted" style="margin:8px 0 0">
              {seam === "fade" ? "Best for repeating prints: the picture’s edges are blended so the print carries on with no visible join." : "Best for a picture with one clear subject: the left and right edges meet at the join, so you will see a join there."}
            </p>
            <label class="field" style="margin-top:12px">
              <span class="small muted">Tidy up: remove patches smaller than {minPatch} squares</span>
              <input class="range" type="range" min="1" max="12" step="1" value={minPatch} onInput={(e) => setMinPatch(Number((e.currentTarget as HTMLInputElement).value))} />
            </label>
          </div>

          <div class="card">
            <h2>The colours</h2>
            {roles ? (
              <div class="stack">
                {roles.centres.map((c, r) => (
                  <div key={r} class="row" style="flex-wrap:wrap">
                    <input type="color" class="colour-input" aria-label={`Colour for ${yarnName(r)}`} value={hexes[r] ?? hexOf(c)} onInput={(e) => setHex(r, (e.currentTarget as HTMLInputElement).value)} />
                    <input class="input" style="flex:1;min-width:140px" aria-label={`Name of colour ${r + 1}`} value={names[r] ?? ""} placeholder={`colour ${r + 1}`} onInput={(e) => setName(r, (e.currentTarget as HTMLInputElement).value)} />
                    <span class="small muted num">{pct(roles.shares[r] as number)} of the hat</span>
                  </div>
                ))}
                <p class="small muted" style="margin:0">Change these to your real yarn colours if you like. The chart keeps the shapes.</p>
              </div>
            ) : (
              <p class="small muted">Working out the colours…</p>
            )}
          </div>

          {built?.chart && (
            <div class="card">
              <h2>Your picture on the hat</h2>
              <label class="check">
                <input type="checkbox" checked={wrapView} onChange={(e) => setWrapView((e.currentTarget as HTMLInputElement).checked)} />
                Show the join: the hat twice side by side
              </label>
              <Flat chart={built.chart} wrap={wrapView} label="Your picture as it will look on the outside of the hat, laid flat, crown at the top." />
            </div>
          )}

          <div class="row">
            <button class="btn" onClick={() => setStage("picture")}>
              Back
            </button>
            <button class="btn primary" style="flex:1" disabled={!roles || !!busy} onClick={() => setStage("knit")}>
              Next: how to knit it
            </button>
          </div>
        </div>
      )}

      {stage === "knit" && roles && (
        <div class="stack">
          {roles.centres.length === 3 && (
            <div class="card">
              <h2>Which colour is embroidered?</h2>
              <p class="small">Two colours are knitted and the third is worked on top in duplicate stitch, on both faces. Here are the three ways to do it, outside and inside.</p>
              <div role="radiogroup" aria-label="Which colour to embroider" class="stack">
                {colourways.map((w) => (
                  <label key={w.d} class={`option ${(dupRole ?? 2) === w.d ? "sel" : ""}`}>
                    <input type="radio" name="dup" checked={(dupRole ?? 2) === w.d} onChange={() => setDupRole(w.d)} />
                    <span style="flex:1;min-width:0">
                      <strong>Embroider {yarnName(w.d)}</strong>
                      {w.d === best && <span class="pill" style="margin-left:8px">Most contrast</span>}
                      {w.chart ? (
                        <span class="grid2" style="margin-top:8px;display:grid">
                          <Flat chart={w.chart} label={`Outside, with ${yarnName(w.d)} in duplicate stitch`} />
                          <Flat chart={w.chart} inside label={`Inside, with ${yarnName(w.d)} in duplicate stitch`} />
                        </span>
                      ) : (
                        <span class="small muted"> can’t be made into a chart</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              <label class="check" style="margin-top:8px">
                <input type="checkbox" checked={swap} onChange={(e) => setSwap((e.currentTarget as HTMLInputElement).checked)} />
                Put the other main colour on the outside
              </label>
            </div>
          )}

          {comparison && (
            <div class="card">
              <h2>Two ways to use {roles.centres.length} colours</h2>
              <div role="radiogroup" aria-label="Which way" class="stack">
                <label class={`option ${chosenRoute === "A" ? "sel" : ""}`}>
                  <input type="radio" name="route" checked={chosenRoute === "A"} onChange={() => setRoute("A")} />
                  <span>
                    <strong>Knit two colours, embroider the rest</strong>
                    {comparison.recommend === "A" && <span class="pill" style="margin-left:8px">Suggested</span>}
                    <br />
                    <span class="small muted">
                      {pct(comparison.a.duplicateShare)} duplicate stitch, no yarn changes, 2 yarns carried. Best for small scattered accents.
                    </span>
                  </span>
                </label>
                <label class={`option ${chosenRoute === "B" ? "sel" : ""}`}>
                  <input type="radio" name="route" checked={chosenRoute === "B"} onChange={() => setRoute("B")} />
                  <span>
                    <strong>Stripes</strong>
                    {comparison.recommend === "B" && <span class="pill" style="margin-left:8px">Suggested</span>}
                    <br />
                    <span class="small muted">
                      {pct(comparison.b.duplicateShare)} duplicate stitch, {comparison.b.yarnChanges} yarn changes in {comparison.b.blocks} stripe blocks. Best for big areas that run in layers.
                    </span>
                  </span>
                </label>
              </div>
              <p class="small" style="margin:8px 0 0">
                <strong>{comparison.recommend === "none" ? "Neither works well." : "Our advice."}</strong> {comparison.reason}
              </p>
            </div>
          )}

          <div class="card">
            <h2>The crown</h2>
            <div class="seg" role="group" aria-label="Crown">
              <button aria-pressed={crownVariant === "patterned" && chosenRoute !== "B"} disabled={comparison !== null && chosenRoute === "B"} onClick={() => setCrownVariant("patterned")}>
                Patterned
              </button>
              <button aria-pressed={crownVariant === "plain" || (comparison !== null && chosenRoute === "B")} onClick={() => setCrownVariant("plain")}>
                Plain
              </button>
            </div>
            <p class="small muted" style="margin:8px 0 0">
              {comparison !== null && chosenRoute === "B"
                ? "A striped hat has a plain crown in the top stripe’s colours."
                : crownVariant === "patterned"
                  ? "The print carries on through the decreases."
                  : `The print carries on to round ${plainFrom - 1}, then the crown is plain.`}
            </p>
          </div>

          {built?.error && (
            <div class="card" role="alert" style="border-color:var(--error)">
              <h3 style="color:var(--error)">That can’t be made into a chart</h3>
              <p style="margin:0">{built.error}</p>
            </div>
          )}

          {built?.chart && built.analysis && (
            <div class="card">
              <h2>Your chart</h2>
              <p class="small muted">Outside, then inside (the inside is the same print in the other colours).</p>
              <Flat chart={built.chart} label="The chart on the outside of the hat, laid flat." />
              <div style="height:8px" />
              <Flat chart={built.chart} inside label="The chart on the inside of the hat, laid flat." />
              {built.analysis.duplicate.length > 0 && (
                <p class="small" style="margin:8px 0 0">
                  Duplicate stitch: {built.analysis.duplicate.reduce((n, d) => n + d.patches, 0)} patches, {pct(built.analysis.duplicateShare)} of the hat.
                </p>
              )}
              {built.analysis.warnings.map((w) => (
                <p key={w.code} class="small" style={`margin:8px 0 0;color:${w.level === "stop" ? "var(--error)" : "inherit"}`}>
                  <strong>{w.level === "stop" ? "Too much: " : "Note: "}</strong>
                  {w.message}
                </p>
              ))}
            </div>
          )}

          <label class="field">
            <span class="small muted">Name your hat</span>
            <input class="input" value={hatName} onInput={(e) => setHatName((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <div class="row">
            <button class="btn" onClick={() => setStage("colours")}>
              Back
            </button>
            <button class="btn primary" style="flex:1" disabled={!built?.chart || !!busy} onClick={use}>
              Use this chart
            </button>
          </div>
          <p class="small muted">Next you can review it and make changes in the drawing editor.</p>
        </div>
      )}
    </div>
  );
}
