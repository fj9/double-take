import { CELL_ASPECT, FIRST_CROWN_ROUND, LAST_ROUND, PAIRS, analyse, crownLayout, hasDuplicate, insideAt, outsideAt } from "@doubletake/core";
import type { Chart } from "@doubletake/core";
import { chartSvg } from "./svg";
import { slug } from "./files";

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csvRow = (cells: string[]) => cells.map(csvCell).join(",");
const header = (first: string) => csvRow([first, ...Array.from({ length: PAIRS }, (_, i) => `P${i + 1}`)]);

/** The chart in knitting order: round 1 first, pair 1 first. Blank where a decrease has removed the pair; a slash marks a decrease. */
export function chartCsv(chart: Chart): string {
  const rows = [header("Round")];
  for (let r = 1; r <= LAST_ROUND; r++) {
    const marked = r >= FIRST_CROWN_ROUND ? crownLayout(r).marked : null;
    rows.push(csvRow([String(r), ...Array.from({ length: PAIRS }, (_, p) => {
      const id = outsideAt(chart, r, p + 1);
      return id === null ? "" : marked?.[p] ? `${id}/` : id;
    })]));
  }
  return rows.join("\n") + "\n";
}

/** One duplicate stitch layer: 1 where it is worked, blank elsewhere. */
export function duplicateCsv(chart: Chart, layerIndex: number): string {
  const layer = chart.duplicate[layerIndex];
  const rows = [header("Round")];
  for (let r = 1; r <= LAST_ROUND; r++) {
    rows.push(csvRow([String(r), ...Array.from({ length: PAIRS }, (_, p) => (layer && hasDuplicate(layer, r, p + 1) ? "1" : ""))]));
  }
  return rows.join("\n") + "\n";
}

/** For a striped chart: the two yarns in each body round. */
export function stripesCsv(chart: Chart): string | null {
  if (!chart.round_pairs) return null;
  const name = (id: string) => chart.yarns.find((y) => y.id === id)?.name ?? id;
  const rows = [csvRow(["Round", "Yarn 1", "Yarn 2", "Name 1", "Name 2"])];
  chart.round_pairs.forEach(([a, b], i) => rows.push(csvRow([String(i + 1), a, b, name(a), name(b)])));
  return rows.join("\n") + "\n";
}

export function yarnsCsv(chart: Chart): string {
  const a = analyse(chart);
  const rows = [csvRow(["Id", "Name", "Colour", "Role", "Share of the outside"])];
  for (const y of chart.yarns) rows.push(csvRow([y.id, y.name, y.hex, y.role, `${Math.round((a.outsideShare[y.id] ?? 0) * 1000) / 10}%`]));
  return rows.join("\n") + "\n";
}

export function shoppingList(chart: Chart, name: string): string {
  const a = analyse(chart);
  const lines = [`${name}: shopping list`, "", "Fingering (4-ply) weight yarn. Needles 2.0 mm (US 0). Stitch markers and a blunt tapestry needle.", ""];
  for (const y of chart.yarns) {
    const role = y.role === "main" ? "main colour" : y.role === "stripe" ? "stripe colour" : "duplicate stitch";
    const share = y.role === "duplicate" ? "" : `, ${Math.round((a.outsideShare[y.id] ?? 0) * 100)}% of the outside`;
    lines.push(`${y.id}. ${y.name} (${y.hex}), ${role}${share}`);
  }
  lines.push("", "Yardage isn't calculated yet. Buy more than you think you need and keep some spare: it depends on your design, your tension and your yarn, and duplicate stitch uses the most extra.", "");
  return lines.join("\n");
}

/** The whole hat laid flat as an SVG (vector, so it prints and scales cleanly). Round 1 at the bottom, crown at the top. */
export function flatSvg(chart: Chart, inside: boolean): string {
  const rows = Array.from({ length: LAST_ROUND }, (_, i) => LAST_ROUND - i);
  const cols = Array.from({ length: PAIRS }, (_, i) => (inside ? i + 1 : PAIRS - i));
  return chartSvg({ chart, cols, rows, inside, label: `The hat laid flat, ${inside ? "inside" : "outside"} view` });
}

/** The whole hat laid flat as a PNG. */
export async function flatPng(chart: Chart, inside: boolean, cellW = 8): Promise<Uint8Array> {
  const cellH = Math.max(2, Math.round(cellW / CELL_ASPECT));
  const canvas = document.createElement("canvas");
  canvas.width = PAIRS * cellW;
  canvas.height = LAST_ROUND * cellH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can’t make pictures.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const hex = new Map(chart.yarns.map((y) => [y.id, y.hex] as const));
  for (let r = 1; r <= LAST_ROUND; r++) {
    const y = (LAST_ROUND - r) * cellH;
    for (let col = 0; col < PAIRS; col++) {
      const pair = inside ? col + 1 : PAIRS - col;
      const id = inside ? insideAt(chart, r, pair) : outsideAt(chart, r, pair);
      if (id === null) continue;
      ctx.fillStyle = hex.get(id) ?? "#cccccc";
      ctx.fillRect(col * cellW, y, cellW, cellH);
      for (const layer of chart.duplicate) {
        if (inside && layer.faces === "outside") continue;
        if (!hasDuplicate(layer, r, pair)) continue;
        ctx.fillStyle = hex.get(layer.yarn) ?? "#2a5fd0";
        ctx.fillRect(col * cellW + 1, y + 1, Math.max(1, cellW - 2), Math.max(1, cellH - 2));
      }
    }
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Couldn’t make the picture.");
  return new Uint8Array(await blob.arrayBuffer());
}

// ---- a minimal zip writer (files stored, not compressed) ----
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(data: Uint8Array): number {
  let c = ~0;
  for (const b of data) c = (CRC[(c ^ b) & 255] as number) ^ (c >>> 8);
  return ~c >>> 0;
}

export interface ZipFile {
  name: string;
  data: Uint8Array;
  /** The same bytes squeezed with deflate, if that made them smaller. */
  deflated?: Uint8Array;
}

/** Squeeze each file with deflate where the browser can (every current browser can). Others are stored as they are. */
export async function compressFiles(files: ZipFile[]): Promise<ZipFile[]> {
  if (typeof CompressionStream === "undefined") return files;
  return Promise.all(
    files.map(async (f) => {
      if (f.data.length < 200) return f;
      const stream = new Blob([f.data as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      const deflated = new Uint8Array(await new Response(stream).arrayBuffer());
      return deflated.length < f.data.length ? { ...f, deflated } : f;
    }),
  );
}

export function makeZip(files: ZipFile[], when = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const date = ((Math.max(1980, when.getFullYear()) - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const time = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (v: number) => [v & 255, (v >>> 8) & 255];
  const u32 = (v: number) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const body = f.deflated ?? f.data;
    const method = f.deflated ? 8 : 0;
    const local = Uint8Array.from([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(method), ...u16(time), ...u16(date), ...u32(crc), ...u32(body.length), ...u32(f.data.length), ...u16(name.length), ...u16(0)]);
    parts.push(local, name, body);
    central.push(Uint8Array.from([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(method), ...u16(time), ...u16(date), ...u32(crc), ...u32(body.length), ...u32(f.data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name);
    offset += local.length + name.length + body.length;
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of all) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Everything in one zip: the chart file, pictures, vector pictures, spreadsheets and the shopping list. */
export async function exportAll(chart: Chart, name: string): Promise<{ filename: string; data: Uint8Array }> {
  const enc = new TextEncoder();
  const text = (n: string, s: string): ZipFile => ({ name: n, data: enc.encode(s) });
  const base = slug(name);
  const files: ZipFile[] = [
    text(`${base}.doubletake.json`, JSON.stringify(chart, null, 1)),
    { name: "outside.png", data: await flatPng(chart, false) },
    { name: "inside.png", data: await flatPng(chart, true) },
    text("outside.svg", flatSvg(chart, false)),
    text("inside.svg", flatSvg(chart, true)),
    text("chart.csv", chartCsv(chart)),
    text("yarns.csv", yarnsCsv(chart)),
    text("shopping-list.txt", shoppingList(chart, name)),
  ];
  chart.duplicate.forEach((l, i) => files.push(text(`duplicate-stitch-${l.yarn.toLowerCase()}.csv`, duplicateCsv(chart, i))));
  const stripes = stripesCsv(chart);
  if (stripes) files.push(text("stripes.csv", stripes));
  return { filename: `${base}.zip`, data: makeZip(await compressFiles(files.map((f) => ({ ...f, name: `${base}/${f.name}` })))) };
}
