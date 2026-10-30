import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { analyse, applyTidy, buildChart, mergeRoles, BuildError, compareRoutes, rgbToLab, tilePixels, TILE_ACROSS } from "@doubletake/core";
import type { Chart, Choice, PaletteCheck, Pixels, RoleResult, RoleTidy } from "@doubletake/core";
import { ChartCanvas } from "../components/ChartCanvas";
import { DuplicateAmount, smallest } from "../components/DuplicateAmount";
import type { DupRow } from "../components/DuplicateAmount";
import { FrameEditor } from "../components/FrameEditor";
import { PICTURE_SOURCES } from "../content";
import { DEFAULT_CROP, cropBox } from "../lib/crop";
import type { CropSettings } from "../lib/crop";
import { decodePicture } from "../lib/decode";
import { Generator } from "../lib/generator";
import type { ChartView } from "../lib/render";
import { SAMPLES, drawSample, sampleSource, sampleUrl } from "../lib/samples";
import type { Sample } from "../lib/samples";
import { isDark } from "../lib/settings";
import { useWidth } from "../lib/useWidth";
import { createProject } from "../store";

const hexOf = (c: number[]) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

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

/** A chart laid flat, sized to fit its box. `picture` shows it as it will look knitted; `bodyOnly` leaves out the crown. */
function Flat({ chart, inside, wrap, label, picture, bodyOnly }: { chart: Chart; inside?: boolean; wrap?: boolean; label: string; picture?: boolean; bodyOnly?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const once = Array.from({ length: 112 }, (_, i) => (inside ? i + 1 : 112 - i));
  const cols = wrap ? [...once, ...once] : once;
  const cellW = Math.max(1.2, (width - 40) / cols.length);
  const last = bodyOnly ? 75 : 95;
  const view: ChartView = { chart, cols, rows: Array.from({ length: last }, (_, i) => last - i), cellW, showDuplicate: true, inside: !!inside, highContrast: false, dark: isDark(), picture };
  return (
    <div ref={box} class="chart-box" style="margin:0;min-width:0;max-width:100%">
      <ChartCanvas view={view} label={label} />
    </div>
  );
}

/** A small picture of a sample, drawn in code. */
function SampleThumb({ sample }: { sample: Sample }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current && !sample.file) drawSample(sample.id, ref.current);
  }, [sample]);
  const style = "width:100%;aspect-ratio:2/1;object-fit:cover;border-radius:6px;display:block";
  return sample.file ? <img src={sampleUrl(sample.file)} alt="" width={160} height={80} loading="lazy" style={style} /> : <canvas ref={ref} width={160} height={80} aria-hidden="true" style={style} />;
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
const tileKeyOf = (t: { on: boolean; across: number; mirror: boolean }) => (t.on ? `${t.across}:${t.mirror}` : "off");

export function MakeScreen() {
  const gen = useRef<Generator | null>(null);
  const getGen = () => (gen.current ??= new Generator());
  useEffect(() => () => gen.current?.stop(), []);

  const [pic, setPic] = useState<{ pixels: Pixels; name: string } | null>(null);
  const [loadedKey, setLoadedKey] = useState("off"); // which version of the picture (whole, or repeated like so) the worker holds
  const [palette, setPalette] = useState<PaletteCheck | null>(null);
  const [crop, setCrop] = useState<CropSettings>(DEFAULT_CROP);
  const [tile, setTile] = useState({ on: false, across: 4, mirror: true });
  const tileKey = useRef("off");
  const [colours, setColours] = useState(3);
  const [seam, setSeam] = useState<"fade" | "accept">("fade");
  const [stray, setStray] = useState(true);
  const [dupP, setDupP] = useState<number[]>([10, 10, 10, 10]); // amount for each duplicate colour, 1 (less) to 12 (more)
  const [dupAll, setDupAll] = useState(10);
  const [dupUse, setDupUse] = useState<boolean[]>([true, true, true, true]);
  const [rawRoles, setRawRoles] = useState<RoleResult | null>(null);
  const [merges, setMerges] = useState<{ from: number; into: number }[]>([]); // colours joined together, in order
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wrapView, setWrapView] = useState(false);
  const [mode, setMode] = useState<"picture" | "chart">("picture");
  const [face, setFace] = useState<"outside" | "inside">("outside");

  const [dupRole, setDupRole] = useState<number | null>(null);
  const [swap, setSwap] = useState(false);
  const [route, setRoute] = useState<"A" | "B" | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [hexes, setHexes] = useState<string[]>([]);
  const [hatName, setHatName] = useState("My hat");

  const seq = useRef(0);
  const paletteSeq = useRef(0);

  /** The picture the colours are found from: the one chosen, or that repeated across the hat. */
  const source = useMemo<Pixels | null>(() => (pic ? (tile.on ? tilePixels(pic.pixels, tile) : pic.pixels) : null), [pic, tile.on, tile.across, tile.mirror]);
  const activeCrop = tile.on ? DEFAULT_CROP : crop;

  const defaults = (n: number) => ({ p: n <= 3 ? 10 : 8 });
  const setAmount = (p: number) => {
    setDupAll(p);
    setDupP([p, p, p, p]);
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy("Opening your picture…");
    try {
      await startFrom(await decodePicture(file), file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t open that picture.");
    } finally {
      setBusy(null);
    }
  };

  const chooseSample = async (sample: Sample) => {
    setError(null);
    setBusy("Opening the sample…");
    try {
      const source = await sampleSource(sample);
      await startFrom("file" in source ? await decodePicture(source.file) : source.pixels, sample.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t open that sample.");
    } finally {
      setBusy(null);
    }
  };

  /** Start from a picture, whether it came from a file or is a sample. */
  const startFrom = async (pixels: Pixels, fileName: string) => {
    {
      const g = getGen();
      await g.load(pixels);
      const p = await g.palette(cropBox(pixels.width, pixels.height, DEFAULT_CROP));
      tileKey.current = "off";
      setTile({ on: false, across: 4, mirror: true });
      setPic({ pixels, name: fileName });
      setPalette(p);
      setLoadedKey("off");
      setHatName(fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "My hat");
      const n = Math.max(2, Math.min(6, p.palette.length));
      const start = p.coverage < 0.7 ? Math.min(n, 3) : n;
      setColours(start);
      setSeam(start <= 3 ? "fade" : "accept");
      setStray(true);
      setAmount(defaults(start).p);
      setDupUse([true, true, true, true]);
      setCrop(DEFAULT_CROP);
      setRawRoles(null);
      setMerges([]);
      setNames([]);
      setHexes([]);
      setDupRole(null);
      setSwap(false);
      setRoute(null);
    }
  };

  // When the picture is repeated (or not), the worker is given the repeated picture
  useEffect(() => {
    if (!pic || !source || tileKey.current === tileKeyOf(tile)) return;
    const key = tileKeyOf(tile);
    tileKey.current = key;
    let cancelled = false;
    setBusy("Repeating your picture…");
    void getGen()
      .load(source)
      .then(() => {
        if (!cancelled) setLoadedKey(key);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn’t repeat that picture."));
    return () => {
      cancelled = true;
    };
  }, [pic, source, tile.on, tile.across, tile.mirror]);

  // The real colours, their shares and the warnings come from the part of the picture inside the frame, so they follow it
  useEffect(() => {
    if (!pic || !source || loadedKey !== tileKeyOf(tile)) return;
    const mine = ++paletteSeq.current;
    const t = setTimeout(async () => {
      try {
        const p = await getGen().palette(cropBox(source.width, source.height, activeCrop));
        if (mine === paletteSeq.current) setPalette(p);
      } catch {
        /* keep the colours already shown */
      }
    }, 350);
    return () => clearTimeout(t);
  }, [pic, source, loadedKey, crop, tile.on]);

  // Work out the colours whenever the settings change, after a short pause
  useEffect(() => {
    if (!pic || !source || loadedKey !== tileKeyOf(tile)) return;
    const mine = ++seq.current;
    setBusy("Working on your picture…");
    const t = setTimeout(async () => {
      try {
        const r = await getGen().roles({ colours, seam, minPatch: stray ? 2 : 1, crop: cropBox(source.width, source.height, activeCrop) });
        if (mine !== seq.current) return;
        setRawRoles(r);
        setError(null);
      } catch (e) {
        if (mine === seq.current) setError(e instanceof Error ? e.message : "Couldn’t work out the colours.");
      } finally {
        if (mine === seq.current) setBusy(null);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [pic, source, loadedKey, crop, tile.on, colours, seam, stray]);

  // Joined colours: the colours found, with each pair in `merges` merged in turn
  const roles = useMemo(() => {
    if (!rawRoles) return null;
    return merges.reduce((r, m) => mergeRoles(r, m.from, m.into).roles, rawRoles);
  }, [rawRoles, merges]);
  useEffect(() => setMerges([]), [pic, colours, seam, stray, tile.on, tile.across, tile.mirror]);

  const merge = (from: number, into: number) => {
    if (!roles) return;
    const { order } = mergeRoles(roles, from, into);
    // Names and colours chosen follow their colour to its new number
    setNames(order.map((old) => names[old] ?? ""));
    setHexes(order.map((old) => hexes[old] ?? ""));
    setMerges([...merges, { from, into }]);
    setDupRole(null);
    setSwap(false);
    setRoute(null);
    setDupUse([true, true, true, true]);
  };
  const undoMerge = () => {
    setMerges(merges.slice(0, -1));
    setNames([]);
    setHexes([]);
    setDupRole(null);
    setSwap(false);
    setRoute(null);
  };

  const k = roles?.centres.length ?? 0;

  // Compare the two ways to use four or more colours, with the duplicate stitch amount applied
  const comparison = useMemo(() => {
    if (!roles || k <= 3) return null;
    const settings: (RoleTidy | undefined)[] = Array.from({ length: k }, (_, r) => (r >= 2 ? { min: smallest(dupP[r - 2] as number), leave: !dupUse[r - 2] } : undefined));
    return compareRoutes(applyTidy(roles, settings).roles.grid);
  }, [roles, dupP, dupUse]);
  const chosenRoute = route ?? (comparison && comparison.recommend === "B" ? "B" : "A");

  /** Which colours are embroidered, and so get the duplicate stitch amount. */
  const dupRoles = k === 3 ? [dupRole ?? 2] : k >= 4 && chosenRoute === "A" ? range(2, k) : [];

  const tidySettings = (dups: number[]): (RoleTidy | undefined)[] => {
    if (k <= 2) return [];
    if (k >= 4 && chosenRoute === "B") return Array.from({ length: k }, (_, r) => (r >= 1 ? { min: smallest(dupAll) } : undefined));
    const out: (RoleTidy | undefined)[] = Array.from({ length: k }, () => undefined);
    dups.forEach((role, i) => (out[role] = { min: smallest(dupP[i] as number), leave: !dupUse[i] }));
    return out;
  };

  const tidied = useMemo(() => (roles ? applyTidy(roles, tidySettings(dupRoles)) : null), [roles, dupRole, chosenRoute, dupP, dupAll, dupUse]);

  const choice = (): Choice => {
    if (!roles) return { kind: "two" };
    if (k === 2) return { kind: "two" };
    if (k === 3) {
      const d = dupRole ?? 2;
      const rest = [0, 1, 2].filter((r) => r !== d);
      return { kind: "duplicate", dupRoles: [d], outsideRole: swap ? (rest[1] as number) : (rest[0] as number) };
    }
    return chosenRoute === "B" ? { kind: "stripes" } : { kind: "duplicate" };
  };

  const buildOpts = { name: hatName, yarnNames: names, yarnHex: hexes };
  const settingsNote = { strayMinimum: stray ? 2 : 1, duplicateKept: dupRoles.map((role, i) => ({ colour: role, smallestPatch: dupUse[i] ? smallest(dupP[i] as number) : null })) };
  const built = useMemo(() => {
    if (!tidied) return null;
    try {
      const chart = buildChart(tidied.roles, choice(), { ...buildOpts, settings: settingsNote });
      return { chart, analysis: analyse(chart), error: null as string | null };
    } catch (e) {
      return { chart: null, analysis: null, error: e instanceof BuildError ? e.message : "That choice can’t be made into a chart." };
    }
  }, [tidied, dupRole, swap, chosenRoute, names, hexes, hatName]);

  // For three colours: all three ways to knit it, to compare, each with the same amount of duplicate stitch
  const colourways = useMemo(() => {
    if (!roles || k !== 3) return [];
    return [0, 1, 2].map((d) => {
      const rest = [0, 1, 2].filter((r) => r !== d) as [number, number];
      const lab = (r: number) => rgbToLab(...(roles.centres[r] as [number, number, number]));
      const [a, b] = [lab(rest[0]), lab(rest[1])];
      const contrast = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      let chart: Chart | null = null;
      try {
        const t = applyTidy(roles, [0, 1, 2].map((r) => (r === d ? { min: smallest(dupP[0] as number), leave: !dupUse[0] } : undefined)));
        chart = buildChart(t.roles, { kind: "duplicate", dupRoles: [d], outsideRole: swap ? rest[1] : rest[0] }, buildOpts);
      } catch {
        chart = null;
      }
      return { d, chart, contrast };
    });
  }, [roles, swap, names, hexes, hatName, dupP, dupUse]);
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

  // What the duplicate stitch amount did, colour by colour, from the finished chart
  const showAmount = !!roles && built?.chart && built.analysis && built.analysis.duplicate.length > 0 && (k === 3 || (k >= 4 && chosenRoute === "A") || (k >= 4 && chosenRoute === "B"));
  const rows: DupRow[] = useMemo(() => {
    if (!tidied || !built?.analysis) return [];
    return dupRoles.map((role, i) => {
      const stat = tidied.stats[role];
      const row = built.analysis?.duplicate[i];
      return {
        name: yarnName(role),
        hex: hexes[role] ?? hexOf(roles?.centres[role] ?? [128, 128, 128]),
        p: dupP[i] as number,
        use: !!dupUse[i],
        share: row?.share ?? 0,
        patches: stat?.keptPatches ?? 0,
        smallest: stat?.smallest ?? null,
        removedPatches: stat?.removedPatches ?? 0,
      };
    });
  }, [tidied, built, dupP, dupUse, names, hexes, dupRole, chosenRoute]);
  const perColour = rows.length > 1 && chosenRoute === "A";

  const previewChart = built?.chart ?? null;

  return (
    <div>
      <h1>Make a chart from a picture</h1>
      <p class="small muted">Your picture stays on this device. Nothing is uploaded.</p>

      {error && (
        <div class="card" role="alert" style="border-color:var(--error)">
          <p style="margin:0">{error}</p>
        </div>
      )}
      <div aria-live="polite" class="small muted" style="min-height:24px">
        {busy}
      </div>

      <div class={`make-layout ${pic ? "has-pic" : ""}`}>
        <div class="card">
          <h2>Choose a picture</h2>
          {!pic && <p class="small">A pattern, a print or a simple picture works best. Big flat areas of colour knit better than fine detail. Only use pictures you have the right to use.</p>}
          <div class="row" style="flex-wrap:wrap">
            <input id="pic-file" class="sr-only" aria-label="Choose a picture from your files" type="file" accept="image/*" onChange={(e) => choose((e.currentTarget as HTMLInputElement).files?.[0])} />
            <label class="btn primary" for="pic-file">
              {pic ? "Choose a different picture" : "Choose a picture"}
            </label>
            <input id="pic-cam" class="sr-only" aria-label="Take a photo" type="file" accept="image/*" capture="environment" onChange={(e) => choose((e.currentTarget as HTMLInputElement).files?.[0])} />
            <label class="btn" for="pic-cam">
              Take a photo
            </label>
          </div>
          <h3 style="margin:16px 0 4px">Or try a sample</h3>
          <div class="samples" role="group" aria-label="Sample pictures">
            {SAMPLES.map((sm) => (
              <button key={sm.id} class="sample" onClick={() => chooseSample(sm)}>
                <SampleThumb sample={sm} />
                <strong>{sm.name}</strong>
                <span class="small muted">{sm.blurb}</span>
              </button>
            ))}
          </div>
          <h3 style="margin:16px 0 4px">Find a picture</h3>
          <p class="small" style="margin:0 0 4px">
            Free pictures to start from. Check the licence of anything you download.
          </p>
          <p class="small" style="margin:0">
            {PICTURE_SOURCES.map((src, i) => (
              <span key={src.name}>
                {i > 0 && " · "}
                <a href={src.url} target="_blank" rel="noopener noreferrer">
                  {src.name}
                </a>
              </span>
            ))}{" "}
            <span class="muted">on Pixabay</span>
          </p>
          <p class="small muted" style="margin:8px 0 0">
            Sample pictures from Pixabay, free to use, by{" "}
            {SAMPLES.filter((sm) => sm.credit).map((sm, i, all) => (
              <span key={sm.id}>
                <a href={sm.credit?.url} target="_blank" rel="noopener noreferrer">
                  {sm.credit?.by}
                </a>
                {i < all.length - 2 ? ", " : i === all.length - 2 ? " and " : ""}
              </span>
            ))}
            .
          </p>
        </div>

        {pic && palette && source && (
          <>
            <section class="make-preview" aria-labelledby="hat-preview">
              <div class="row between" style="flex-wrap:wrap;gap:8px;margin-bottom:6px">
                <h2 id="hat-preview" style="margin:0;font-size:16px">
                  Your picture on the hat
                </h2>
                <div class="row" style="gap:8px">
                  <div class="seg" role="group" aria-label="How to show it">
                    <button aria-pressed={mode === "picture"} onClick={() => setMode("picture")}>
                      Picture
                    </button>
                    <button aria-pressed={mode === "chart"} onClick={() => setMode("chart")}>
                      Chart
                    </button>
                  </div>
                  <div class="seg" role="group" aria-label="Which face">
                    <button aria-pressed={face === "outside"} onClick={() => setFace("outside")}>
                      Outside
                    </button>
                    <button aria-pressed={face === "inside"} onClick={() => setFace("inside")}>
                      Inside
                    </button>
                  </div>
                </div>
              </div>
              {previewChart ? (
                <Flat chart={previewChart} inside={face === "inside"} picture={mode === "picture"} bodyOnly label={`Your picture as it will look on the ${face} of the hat, laid flat.`} />
              ) : (
                <p class="small muted" style="margin:0">Working out the colours…</p>
              )}
            </section>

            <div class="card">
              <h2>Frame</h2>
              <p class="small">The hat is about twice as wide as it is tall. Choose the part of your picture to use.</p>
              <FrameEditor pixels={source} crop={crop} onCrop={setCrop} framed={!tile.on} />
              <div class="stack" style="margin-top:16px">
                <label class="check">
                  <input
                    type="checkbox"
                    checked={tile.on}
                    onChange={(e) => {
                      const on = (e.currentTarget as HTMLInputElement).checked;
                      setTile({ ...tile, on });
                      if (on && tile.mirror) setSeam("accept");
                    }}
                  />
                  Repeat the picture across the hat
                </label>
                {tile.on && (
                  <div class="stack">
                    <label class="field" style="margin:0">
                      <span class="small muted">Copies across the hat</span>
                      <select class="select" value={tile.across} onChange={(e) => setTile({ ...tile, across: Number((e.currentTarget as HTMLSelectElement).value) })}>
                        {TILE_ACROSS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label class="check">
                      <input
                        type="checkbox"
                        checked={tile.mirror}
                        onChange={(e) => {
                          const mirror = (e.currentTarget as HTMLInputElement).checked;
                          setTile({ ...tile, mirror });
                          if (mirror) setSeam("accept");
                        }}
                      />
                      Flip every other copy, so the edges match
                    </label>
                    <p class="small muted" style="margin:0">Copies that divide the hat evenly, flipped, join up with no seam.</p>
                  </div>
                )}
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

            <div class="card">
              <h2>How many colours?</h2>
              <div class="seg" role="group" aria-label="Number of colours">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    aria-pressed={colours === n}
                    onClick={() => {
                      setColours(n);
                      setSeam(tile.on && tile.mirror ? "accept" : n <= 3 ? "fade" : "accept");
                      setAmount(defaults(n).p);
                      setDupUse([true, true, true, true]);
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
              {roles ? (
                <div class="stack" style="margin-top:12px">
                  {roles.centres.map((c, r) => (
                    <div key={r} class="row" style="flex-wrap:wrap">
                      <input type="color" class="colour-input" aria-label={`Colour for ${yarnName(r)}`} value={hexes[r] ?? hexOf(c)} onInput={(e) => setHex(r, (e.currentTarget as HTMLInputElement).value)} />
                      <input class="input" style="flex:1;min-width:140px" aria-label={`Name of colour ${r + 1}`} value={names[r] ?? ""} placeholder={`colour ${r + 1}`} onInput={(e) => setName(r, (e.currentTarget as HTMLInputElement).value)} />
                      <span class="small muted num">{pct(roles.shares[r] as number)} of the hat</span>
                      {k > 2 && (
                        <select
                          class="select"
                          style="width:auto"
                          aria-label={`Merge ${yarnName(r)} into another colour`}
                          value=""
                          onChange={(e) => {
                            const into = Number((e.currentTarget as HTMLSelectElement).value);
                            if (!Number.isNaN(into)) merge(r, into);
                          }}
                        >
                          <option value="">Merge into…</option>
                          {roles.centres.map((_, o) => o !== r && (
                            <option key={o} value={o}>
                              {yarnName(o)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                  {merges.length > 0 && (
                    <div class="row" style="flex-wrap:wrap;gap:8px">
                      <span class="small">
                        {merges.length} {merges.length === 1 ? "merge" : "merges"} made. {rawRoles?.centres.length} colours found, {k} used.
                      </span>
                      <button class="btn small" onClick={undoMerge}>
                        Undo last merge
                      </button>
                    </div>
                  )}
                  <p class="small muted" style="margin:0">Change these to your real yarn colours if you like. The chart keeps the shapes.</p>
                </div>
              ) : (
                <p class="small muted">Working out the colours…</p>
              )}
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
              <label class="check" style="margin-top:8px">
                <input type="checkbox" checked={stray} onChange={(e) => setStray((e.currentTarget as HTMLInputElement).checked)} />
                Remove single stray squares
              </label>
            </div>

            {showAmount && built?.analysis && (
              <div class="card" aria-labelledby="dup-amount">
                <h2 id="dup-amount">Duplicate stitch</h2>
                <p class="small">Worked on top after blocking. Fewer, bigger patches are easier to embroider.</p>
                <DuplicateAmount
                  rows={rows}
                  all={dupAll}
                  total={built.analysis.duplicateShare}
                  perColour={perColour}
                  onAll={setAmount}
                  onRow={(i, p) => setDupP(dupP.map((v, j) => (j === i ? p : v)))}
                  onUse={(i, u) => setDupUse(dupUse.map((v, j) => (j === i ? u : v)))}
                />
              </div>
            )}

            {roles && roles.centres.length === 3 && (
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
                            <Flat chart={w.chart} picture label={`Outside, with ${yarnName(w.d)} in duplicate stitch`} />
                            <Flat chart={w.chart} picture inside label={`Inside, with ${yarnName(w.d)} in duplicate stitch`} />
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

            {roles && comparison && (
              <div class="card">
                <h2>Two ways to use {roles.centres.length} colours</h2>
                <div role="radiogroup" aria-label="Which way" class="stack">
                  <label class={`option ${chosenRoute === "A" ? "sel" : ""}`}>
                    <input type="radio" name="route" checked={chosenRoute === "A"} onChange={() => setRoute("A")} />
                    <span>
                      <strong>Knit two colours, embroider the rest</strong>
                      {comparison.recommend === "A" && <span class="pill" style="margin-left:8px">Suggested</span>}
                      <br />
                      <span class="small muted">{pct(comparison.a.duplicateShare)} duplicate stitch, no yarn changes, 2 yarns carried. Best for small scattered accents.</span>
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

            {roles && (
              <div class="card">
                <h2>The crown</h2>
                <p class="small" style="margin:0">
                  {comparison !== null && chosenRoute === "B"
                    ? "A striped hat has a crown in one colour, in the top stripe’s colours."
                    : "The print fades out over the first rounds of the crown and is gone by round 85, so the top of the hat is one colour. The drawing editor lets you change the crown if you want more print there."}
                </p>
              </div>
            )}

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
                <label class="check">
                  <input type="checkbox" checked={wrapView} onChange={(e) => setWrapView((e.currentTarget as HTMLInputElement).checked)} />
                  Show the join: the hat twice side by side
                </label>
                <Flat chart={built.chart} wrap={wrapView} label="The chart on the outside of the hat, laid flat." />
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

            <div class="stack">
              <label class="field">
                <span class="small muted">Name your hat</span>
                <input class="input" value={hatName} onInput={(e) => setHatName((e.currentTarget as HTMLInputElement).value)} />
              </label>
              <button class="btn primary block" disabled={!built?.chart || !!busy} onClick={use}>
                Use this chart
              </button>
              <p class="small muted" style="margin:0">Next you can review it and make changes in the drawing editor.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
