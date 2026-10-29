import { CELL_ASPECT, LAST_ROUND, insideAt, outsideAt, crownLayout, BODY_ROUNDS, FIRST_CROWN_ROUND } from "@doubletake/core";
import type { Chart } from "@doubletake/core";

export interface ChartView {
  chart: Chart;
  /** Pair numbers, left to right. Outside charts run 56 … 1 (stitch 1 at the right). */
  cols: number[];
  /** Round numbers, top to bottom. */
  rows: number[];
  /** Cell width in CSS pixels. Cells are 1.36 times wider than tall, like the knitted fabric. */
  cellW: number;
  /** Round to highlight. Other rows are faded. */
  current?: number;
  /** Pairs 1 to this number are done in the current round. */
  marker?: number | null;
  showDuplicate: boolean;
  inside: boolean;
  highContrast: boolean;
  dark: boolean;
  /** Cells to pick out ("round:pair"); everything else is faded. */
  highlight?: Set<string>;
  /** Extra drawing on top, such as symmetry lines in the editor. */
  decorate?: (ctx: CanvasRenderingContext2D, g: Geometry) => void;
}

export const cellKey = (round: number, pair: number) => `${round}:${pair}`;

export function textOn(hex: string): "#000000" | "#ffffff" {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return l > 0.4 ? "#000000" : "#ffffff";
}

export interface Geometry {
  cellW: number;
  cellH: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function geometry(view: Pick<ChartView, "cols" | "rows" | "cellW">): Geometry {
  const cellW = view.cellW;
  const cellH = cellW / CELL_ASPECT;
  const strip = Math.max(14, cellH * 1.5);
  const left = 6;
  const top = strip;
  const bottom = strip;
  const right = Math.max(28, cellW * 3);
  return {
    cellW,
    cellH,
    left,
    top,
    right,
    bottom,
    width: left + view.cols.length * cellW + right,
    height: top + view.rows.length * cellH + bottom,
  };
}

/** Which cell is at a point on the canvas (CSS pixels), if any. */
export function hitTest(view: ChartView, x: number, y: number): { round: number; pair: number } | null {
  const g = geometry(view);
  const c = Math.floor((x - g.left) / g.cellW);
  const r = Math.floor((y - g.top) / g.cellH);
  const pair = view.cols[c];
  const round = view.rows[r];
  if (pair === undefined || round === undefined || c < 0 || r < 0) return null;
  return { round, pair };
}

function hasDuplicate(chart: Chart, layer: number, round: number, pair: number): boolean {
  const l = chart.duplicate[layer];
  if (!l) return false;
  const row = round <= BODY_ROUNDS ? l.body[round - 1] : l.crown[round - FIRST_CROWN_ROUND];
  return row?.[pair - 1] === "1";
}

export function draw(canvas: HTMLCanvasElement, view: ChartView): void {
  const g = geometry(view);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.ceil(g.width * dpr);
  canvas.height = Math.ceil(g.height * dpr);
  canvas.style.width = `${g.width}px`;
  canvas.style.height = `${g.height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, g.width, g.height);

  const { chart, cols, rows } = view;
  const ink = view.dark ? "#e8edf5" : "#1b2a41";
  const text = view.dark ? "#f2f4f8" : "#111111";
  const thin = view.dark ? "#44546f" : "#aab1bd";
  const halo = view.dark ? "#0f1826" : "#ffffff";
  const coral = "#f26b5b";
  // Letters only where a cell is big enough to hold one; on small overviews the colours do the work.
  const fontSize = Math.min(g.cellH * 0.72, g.cellW * 0.58);
  const showLetters = fontSize >= 7.5;
  // Grid lines shrink with the cells, and disappear when cells are too small for them to help
  const lineScale = Math.min(1, g.cellW / 10);
  const showLines = g.cellW >= 4;
  const hc = view.highContrast;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Cells
  rows.forEach((round, ri) => {
    const y = g.top + ri * g.cellH;
    const isCurrent = view.current === round;
    const faded = view.current !== undefined && !isCurrent;
    cols.forEach((pair, ci) => {
      const x = g.left + ci * g.cellW;
      const yarnId = view.inside ? insideAt(chart, round, pair) : outsideAt(chart, round, pair);
      if (yarnId === null) return; // removed by a decrease: blank, like the pattern
      const yarn = chart.yarns.find((y2) => y2.id === yarnId);
      const hex = yarn?.hex ?? "#cccccc";
      const picked = view.highlight ? view.highlight.has(cellKey(round, pair)) : true;
      ctx.globalAlpha = faded ? 0.4 : view.highlight && !picked ? 0.35 : 1;
      ctx.fillStyle = hex;
      ctx.fillRect(x, y, g.cellW, g.cellH);
      if (g.cellW >= 6) {
        ctx.strokeStyle = thin;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 0.25, y + 0.25, g.cellW - 0.5, g.cellH - 0.5);
      }
      if (showLetters) {
        ctx.fillStyle = textOn(hex);
        ctx.font = `${hc ? 700 : 400} ${fontSize}px system-ui, sans-serif`;
        ctx.fillText(yarnId, x + g.cellW / 2, y + g.cellH / 2 + 0.5);
      }
      ctx.globalAlpha = 1;
    });
  });

  // Duplicate stitch overlay: a dot in the duplicate colour, with its letter
  if (view.showDuplicate || view.highlight) {
    rows.forEach((round, ri) => {
      const faded = view.current !== undefined && view.current !== round;
      cols.forEach((pair, ci) => {
        chart.duplicate.forEach((layer, li) => {
          if (view.inside && layer.faces === "outside") return;
          if (!hasDuplicate(chart, li, round, pair)) return;
          const yarn = chart.yarns.find((y) => y.id === layer.yarn);
          if (!yarn) return;
          const picked = view.highlight ? view.highlight.has(cellKey(round, pair)) : true;
          const cx = g.left + ci * g.cellW + g.cellW / 2;
          const cy = g.top + ri * g.cellH + g.cellH / 2;
          const r = Math.min(g.cellW, g.cellH) * (picked && view.highlight ? 0.42 : 0.32);
          ctx.globalAlpha = faded ? 0.4 : view.highlight && !picked ? 0.3 : 1;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = yarn.hex;
          ctx.fill();
          ctx.lineWidth = hc ? 2 : 1.2;
          ctx.strokeStyle = halo;
          ctx.stroke();
          ctx.lineWidth = 0.8;
          ctx.strokeStyle = ink;
          ctx.stroke();
          if (r * 2 >= 9) {
            ctx.fillStyle = textOn(yarn.hex);
            ctx.font = `700 ${Math.min(r * 1.3, fontSize)}px system-ui, sans-serif`;
            ctx.fillText(yarn.id, cx, cy + 0.5);
          }
          ctx.globalAlpha = 1;
        });
      });
    });
  }

  // Decreases: a slash in the marked pair
  rows.forEach((round, ri) => {
    if (round < FIRST_CROWN_ROUND) return;
    const { marked } = crownLayout(round);
    const faded = view.current !== undefined && view.current !== round;
    cols.forEach((pair, ci) => {
      if (!marked[pair - 1]) return;
      const x = g.left + ci * g.cellW;
      const y = g.top + ri * g.cellH;
      ctx.globalAlpha = faded ? 0.5 : 1;
      ctx.lineCap = "round";
      ctx.beginPath();
      // Pair 1 is at the right, so a right-leaning decrease leans like the chart in the pattern: "/"
      ctx.moveTo(x + g.cellW * 0.22, y + g.cellH * 0.82);
      ctx.lineTo(x + g.cellW * 0.78, y + g.cellH * 0.18);
      ctx.strokeStyle = halo;
      ctx.lineWidth = hc ? 5 : 3.4;
      ctx.stroke();
      ctx.strokeStyle = ink;
      ctx.lineWidth = hc ? 2.6 : 1.8;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  });

  // Heavy lines after every 5th stitch and every 5th round
  const heavy = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = halo;
    ctx.lineWidth = (hc ? 5 : 3.2) * lineScale;
    ctx.stroke();
    ctx.strokeStyle = hc ? ink : coral;
    ctx.lineWidth = Math.max(0.8, (hc ? 2.6 : 1.6) * lineScale);
    ctx.stroke();
  };
  const bodyBottom = g.top + rows.length * g.cellH;
  for (let ci = 0; showLines && ci < cols.length - 1; ci++) {
    const a = cols[ci] as number;
    const b = cols[ci + 1] as number;
    if (Math.abs(a - b) !== 1) continue;
    if (Math.min(a, b) % 5 === 0) heavy(g.left + (ci + 1) * g.cellW, g.top, g.left + (ci + 1) * g.cellW, bodyBottom);
  }
  rows.forEach((round, ri) => {
    if (showLines && round % 5 === 0 && round < LAST_ROUND) heavy(g.left, g.top + ri * g.cellH, g.left + cols.length * g.cellW, g.top + ri * g.cellH);
  });

  // Position marker in the current row: pairs worked so far are covered, with a coral bar at the boundary
  if (view.current !== undefined && view.marker) {
    const ri = rows.indexOf(view.current);
    if (ri >= 0) {
      const y = g.top + ri * g.cellH;
      cols.forEach((pair, ci) => {
        if (pair > (view.marker as number)) return;
        ctx.fillStyle = view.dark ? "rgba(15,24,38,0.62)" : "rgba(255,255,255,0.62)";
        ctx.fillRect(g.left + ci * g.cellW, y, g.cellW, g.cellH);
      });
      const boundary = cols.findIndex((pair) => pair <= (view.marker as number));
      if (boundary >= 0) {
        const bx = g.left + boundary * g.cellW;
        ctx.fillStyle = coral;
        ctx.fillRect(bx - 1.5, y - 3, 3, g.cellH + 6);
      }
    }
  }

  // Current row outline
  if (view.current !== undefined) {
    const ri = rows.indexOf(view.current);
    if (ri >= 0) {
      ctx.strokeStyle = coral;
      ctx.lineWidth = hc ? 3.5 : 2.5;
      ctx.strokeRect(g.left - 1, g.top + ri * g.cellH - 1, cols.length * g.cellW + 2, g.cellH + 2);
    }
  }

  // Numbers: stitches top and bottom, rounds on the right
  const labelSize = Math.max(9, Math.min(g.cellH * 0.8, 13));
  ctx.font = `${hc ? 700 : 400} ${labelSize}px system-ui, sans-serif`;
  ctx.fillStyle = text;
  // Show a number every 5, 10, 20 or 40 stitches, whichever leaves room for the digits
  const every = g.cellW >= 20 ? 1 : ([5, 10, 20, 40].find((n) => n * g.cellW >= 22) ?? 40);
  cols.forEach((pair, ci) => {
    const show = every === 1 || pair % every === 0 || (pair === 1 && every <= 10);
    if (!show) return;
    const x = g.left + ci * g.cellW + g.cellW / 2;
    ctx.fillText(String(pair), x, g.top / 2);
    ctx.fillText(String(pair), x, bodyBottom + g.bottom / 2);
  });
  ctx.textAlign = "left";
  rows.forEach((round, ri) => {
    const every = g.cellH >= 11 ? 1 : ([5, 10, 20].find((n) => n * g.cellH >= 12) ?? 20);
    if (round % every !== 0 && round !== view.current) return;
    const y = g.top + ri * g.cellH + g.cellH / 2;
    ctx.font = `${round === view.current ? 700 : hc ? 700 : 400} ${labelSize}px system-ui, sans-serif`;
    ctx.fillText(String(round), g.left + cols.length * g.cellW + 6, y);
  });
  view.decorate?.(ctx, g);
}

/** Overview of the whole hat laid flat (rounds 1-95 by pairs 1-112, stitch 1 at the right), for duplicate stitch patches. */
export interface MapState {
  chart: Chart;
  /** Cell key -> patch id for every duplicate cell. */
  cellPatch: Map<string, string>;
  done: Set<string>;
  selected: string | null;
  /** Patch id -> hex colour. */
  colours: Map<string, string>;
  cssWidth: number;
  dark: boolean;
}

export function mapGeometry(cssWidth: number) {
  const cellW = Math.max(2.5, (cssWidth - 4) / 112);
  const cellH = cellW / CELL_ASPECT;
  return { cellW, cellH, pad: 2, width: 112 * cellW + 4, height: LAST_ROUND * cellH + 4 };
}

export function drawMap(canvas: HTMLCanvasElement, s: MapState): void {
  const m = mapGeometry(s.cssWidth);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.ceil(m.width * dpr);
  canvas.height = Math.ceil(m.height * dpr);
  canvas.style.aspectRatio = `${m.width} / ${m.height}`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = s.dark ? "#1d2c46" : "#eef0f4";
  ctx.fillRect(0, 0, m.width, m.height);
  // Hat cells: crown rounds are narrower, so draw only the pairs that exist.
  for (let round = 1; round <= LAST_ROUND; round++) {
    const y = m.pad + (LAST_ROUND - round) * m.cellH;
    for (let pair = 1; pair <= 112; pair++) {
      if (round >= FIRST_CROWN_ROUND && !crownLayout(round).present[pair - 1]) continue;
      const x = m.pad + (112 - pair) * m.cellW;
      ctx.fillStyle = s.dark ? "#16233a" : "#ffffff";
      ctx.fillRect(x, y, m.cellW, m.cellH);
      const id = s.cellPatch.get(cellKey(round, pair));
      if (id === undefined) continue;
      const hex = s.colours.get(id) ?? "#2a5fd0";
      ctx.globalAlpha = s.done.has(id) ? 0.28 : 1;
      ctx.fillStyle = hex;
      ctx.fillRect(x, y, m.cellW, m.cellH);
      ctx.globalAlpha = 1;
      if (s.done.has(id)) {
        ctx.strokeStyle = hex;
        ctx.lineWidth = 0.6;
        ctx.strokeRect(x + 0.3, y + 0.3, m.cellW - 0.6, m.cellH - 0.6);
      }
    }
  }
  // Selected patch: coral frame around each of its cells
  if (s.selected !== null) {
    ctx.strokeStyle = "#f26b5b";
    ctx.lineWidth = 1.6;
    for (const [key, id] of s.cellPatch) {
      if (id !== s.selected) continue;
      const [round, pair] = key.split(":").map(Number) as [number, number];
      ctx.strokeRect(m.pad + (112 - pair) * m.cellW, m.pad + (LAST_ROUND - round) * m.cellH, m.cellW, m.cellH);
    }
  }
}

/** Which patch is at a point on the map (CSS pixels, relative to the canvas), if any. */
export function mapHit(s: MapState, x: number, y: number): string | null {
  const m = mapGeometry(s.cssWidth);
  const pair = 112 - Math.floor((x - m.pad) / m.cellW);
  const round = LAST_ROUND - Math.floor((y - m.pad) / m.cellH);
  let best: string | null = null;
  // Allow a small miss: nearest duplicate cell within one cell in any direction
  for (let dr = 0; dr <= 1 && !best; dr++) {
    for (let dp = 0; dp <= 1 && !best; dp++) {
      for (const [sr, sp] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const id = s.cellPatch.get(cellKey(round + dr * sr, ((pair + dp * sp - 1 + 112) % 112) + 1));
        if (id !== undefined) {
          best = id;
          break;
        }
      }
    }
  }
  return best;
}
