import { CELL_ASPECT, FIRST_CROWN_ROUND, LAST_ROUND, crownLayout, hasDuplicate, insideAt, outsideAt } from "@doubletake/core";
import type { Chart } from "@doubletake/core";
import { textOn } from "./render";

export interface SvgOptions {
  chart: Chart;
  /** Pair numbers, left to right. Outside charts run high to low (stitch 1 at the right). */
  cols: number[];
  /** Round numbers, top to bottom. */
  rows: number[];
  /** Width of a cell in millimetres. Cells are drawn at the knitted proportion, wider than tall. */
  cellMm?: number;
  inside?: boolean;
  /** Put the yarn letter in every cell, so the chart reads without colour. */
  letters?: boolean;
  /** Show only this duplicate stitch layer in colour, with everything else faded. */
  onlyLayer?: number;
  /** Add the number of pairs left at the end of each crown round. */
  counts?: boolean;
  label: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const INK = "#1b2a41";
const CORAL = "#f26b5b";
const MUTED = "#59616e";
const f = (n: number) => n.toFixed(2);

/**
 * A chart as a standalone SVG, in house style: stitch numbers top and bottom, round numbers on the right, heavy
 * coral lines (on a white halo) after every 5th stitch and round, blank cells where a decrease has removed a
 * pair, and a slash on each right-leaning decrease.
 */
export function chartSvg(o: SvgOptions): string {
  const { chart, cols, rows } = o;
  const cw = o.cellMm ?? 2.8;
  const ch = cw / CELL_ASPECT;
  const ml = 1;
  const mt = 4;
  const mr = o.counts ? 14 : 9;
  const mb = 4;
  const gw = cols.length * cw;
  const gh = rows.length * ch;
  const W = ml + gw + mr;
  const H = mt + gh + mb;
  const fs = Math.min(ch * 0.72, cw * 0.6);
  const yarn = new Map(chart.yarns.map((y) => [y.id, y] as const));
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W)}mm" height="${f(H)}mm" role="img" aria-label="${esc(o.label)}" font-family="Arial, Liberation Sans, sans-serif">`,
  );
  out.push(`<title>${esc(o.label)}</title>`);

  rows.forEach((round, ri) => {
    const y = mt + ri * ch;
    const marked = round >= FIRST_CROWN_ROUND ? crownLayout(round).marked : null;
    cols.forEach((pair, ci) => {
      const id = o.inside ? insideAt(chart, round, pair) : outsideAt(chart, round, pair);
      if (id === null) return;
      const x = ml + ci * cw;
      const hex = yarn.get(id)?.hex ?? "#cccccc";
      let dupHere = false;
      if (o.onlyLayer !== undefined) {
        const layer = chart.duplicate[o.onlyLayer];
        dupHere = !!layer && hasDuplicate(layer, round, pair);
        if (dupHere) {
          const dh = yarn.get(layer?.yarn ?? "")?.hex ?? "#2a5fd0";
          out.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(cw)}" height="${f(ch)}" fill="${dh}" stroke="${INK}" stroke-width="0.08"/>`);
          if (o.letters !== false) out.push(`<text x="${f(x + cw / 2)}" y="${f(y + ch / 2 + fs * 0.35)}" font-size="${f(fs)}" text-anchor="middle" font-weight="700" fill="${textOn(dh)}">${esc(layer?.yarn ?? "")}</text>`);
        } else {
          out.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(cw)}" height="${f(ch)}" fill="${hex}" fill-opacity="0.18" stroke="#aab1bd" stroke-width="0.05"/>`);
        }
      } else {
        out.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(cw)}" height="${f(ch)}" fill="${hex}" stroke="#aab1bd" stroke-width="0.05"/>`);
        if (o.letters !== false) out.push(`<text x="${f(x + cw / 2)}" y="${f(y + ch / 2 + fs * 0.35)}" font-size="${f(fs)}" text-anchor="middle" fill="${textOn(hex)}">${esc(id)}</text>`);
        for (const layer of chart.duplicate) {
          if (o.inside && layer.faces === "outside") continue;
          if (!hasDuplicate(layer, round, pair)) continue;
          const dh = yarn.get(layer.yarn)?.hex ?? "#2a5fd0";
          out.push(`<circle cx="${f(x + cw / 2)}" cy="${f(y + ch / 2)}" r="${f(Math.min(cw, ch) * 0.32)}" fill="${dh}" stroke="#ffffff" stroke-width="0.12"/>`);
        }
      }
      if (marked?.[pair - 1]) {
        const line = `x1="${f(x + cw * 0.2)}" y1="${f(y + ch * 0.8)}" x2="${f(x + cw * 0.8)}" y2="${f(y + ch * 0.2)}" stroke-linecap="round"`;
        out.push(`<line ${line} stroke="#ffffff" stroke-width="0.4"/><line ${line} stroke="${INK}" stroke-width="0.2"/>`);
      }
    });
  });

  const heavy = (x1: number, y1: number, x2: number, y2: number) =>
    out.push(
      `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="#ffffff" stroke-width="0.56"/><line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${CORAL}" stroke-width="0.3"/>`,
    );
  for (let ci = 0; ci < cols.length - 1; ci++) {
    const a = cols[ci] as number;
    const b = cols[ci + 1] as number;
    if (Math.abs(a - b) === 1 && Math.min(a, b) % 5 === 0) heavy(ml + (ci + 1) * cw, mt, ml + (ci + 1) * cw, mt + gh);
  }
  rows.forEach((round, ri) => {
    if (round % 5 === 0 && round < LAST_ROUND) heavy(ml, mt + ri * ch, ml + gw, mt + ri * ch);
  });

  // Numbers
  cols.forEach((pair, ci) => {
    const size = pair >= 100 ? 0.95 : 1.2;
    const x = ml + ci * cw + cw / 2;
    out.push(`<text x="${f(x)}" y="${f(mt - 0.9)}" font-size="${size}" text-anchor="middle" fill="#111111">${pair}</text>`);
    out.push(`<text x="${f(x)}" y="${f(mt + gh + 2.2)}" font-size="${size}" text-anchor="middle" fill="#111111">${pair}</text>`);
  });
  if (o.counts) out.push(`<text x="${f(ml + gw + 5.2)}" y="${f(mt - 0.9)}" font-size="0.95" fill="${MUTED}">pairs</text>`);
  rows.forEach((round, ri) => {
    const y = mt + ri * ch + ch / 2 + 0.4;
    out.push(`<text x="${f(ml + gw + 0.8)}" y="${f(y)}" font-size="${f(Math.min(1.2, ch * 0.8))}" fill="#111111">${round}</text>`);
    if (o.counts && round >= FIRST_CROWN_ROUND) {
      out.push(`<text x="${f(ml + gw + 6.2)}" y="${f(y)}" font-size="${f(Math.min(1, ch * 0.7))}" fill="${MUTED}">${crownLayout(round).pairs}</text>`);
    }
  });
  out.push("</svg>");
  return out.join("");
}
