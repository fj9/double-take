import type { Pixels } from "@doubletake/core";

/**
 * Sample pictures. Most are small copies of free Pixabay pictures (Pixabay Content Licence, credited below and in
 * `public/samples/NOTICE.md`). "Sunset layers" is drawn in code and has no source. Each is a few flat colours, the kind
 * of picture that knits well.
 */
export interface Sample {
  id: string;
  name: string;
  blurb: string;
  /** Where the picture file is (in `public/samples`), or null for a sample drawn in code. */
  file: string | null;
  credit?: { by: string; url: string };
}

const pixabay = (id: number) => `https://pixabay.com/images/id-${id}/`;

export const SAMPLES: Sample[] = [
  { id: "leopard", name: "Leopard", blurb: "Four colours with small details. Good for duplicate stitch.", file: "leopard.jpg", credit: { by: "missperfectkaos", url: pixabay(4852724) } },
  { id: "skulls", name: "Skulls", blurb: "Two colours and bold shapes.", file: "skulls.jpg", credit: { by: "anastasia_makarevich", url: pixabay(4645914) } },
  { id: "zebra", name: "Zebra", blurb: "Black and white stripes that flow.", file: "zebra.jpg", credit: { by: "prawny", url: pixabay(1315322) } },
  { id: "giraffe", name: "Giraffe", blurb: "Warm patches with pale lines.", file: "giraffe.jpg", credit: { by: "scarletcat", url: pixabay(7251950) } },
  { id: "wave", name: "Great Wave", blurb: "A picture with a clear subject.", file: "wave.jpg", credit: { by: "Loke_Artemis", url: pixabay(7107112) } },
  { id: "camo", name: "Camouflage", blurb: "Three big patches of colour. Fills a lot of the hat.", file: "camo.jpg", credit: { by: "Clker-Free-Vector-Images", url: pixabay(38657) } },
  { id: "dots", name: "Zigzag and dots", blurb: "Zigzags in three colours, with small dots. Good for duplicate stitch.", file: null },
  { id: "sunset", name: "Sunset layers", blurb: "Five colours in wavy layers. Good for stripes.", file: null },
];

const W = 640;
const H = 320;

/** Zigzags running round the hat in two wide colours, with a thin zigzag of a third between them and a few small dots of two more on top: the thin zigzag and the dots are what duplicate stitch is for. */
function drawDots(ctx: CanvasRenderingContext2D): void {
  const cream = "#f3e9d8";
  const navy = "#24324f";
  const teal = "#2f9aa0";
  const step = 4;
  const period = 160;
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const wave = Math.abs(((x + 80) % period) - 80) / 2; // 0 to 40, up and down along the round
      const at = (y + wave + 8 * period) % period;
      ctx.fillStyle = at < 74 ? cream : at < 86 ? teal : navy;
      ctx.fillRect(x, y, step, step);
    }
  }
  const dots: [number, number, string][] = [
    [70, 40, "#d6285a"], [250, 110, "#f2c200"], [430, 50, "#f2c200"], [580, 120, "#d6285a"],
    [150, 215, "#f2c200"], [340, 280, "#d6285a"], [520, 230, "#f2c200"],
  ];
  for (const [x, y, colour] of dots) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draw a sample that is drawn in code (the picture ones are files) on a canvas of any size. */
export function drawSample(id: string, canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  if (id === "dots") return drawDots(ctx);
  if (id !== "sunset") return;
  // Layers from the sky down. Each edge is a gentle wave, and each layer is one colour, which is what stripes knit well.
  const layers: { colour: string; top: number; wave: number; length: number; phase: number }[] = [
    { colour: "#f6e7d3", top: 0, wave: 0, length: 1, phase: 0 },
    { colour: "#f2b98f", top: 88, wave: 9, length: 150, phase: 0.4 },
    { colour: "#e0795a", top: 140, wave: 12, length: 210, phase: 1.6 },
    { colour: "#8a3f62", top: 198, wave: 10, length: 170, phase: 2.8 },
    { colour: "#2b2540", top: 256, wave: 8, length: 130, phase: 4.1 },
  ];
  for (const l of layers) {
    ctx.fillStyle = l.colour;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) ctx.lineTo(x, l.top + l.wave * Math.sin((x / l.length) * Math.PI * 2 + l.phase));
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }
}

/** The address of a sample's picture file. It is part of the app, so it works offline too. */
export const sampleUrl = (file: string) => `${import.meta.env.BASE_URL}samples/${file}`;

/** The file for a sample picture, or its drawing as pixels. Either can be used like a picture the knitter chose. */
export async function sampleSource(sample: Sample): Promise<{ file: File } | { pixels: Pixels }> {
  if (sample.file) {
    const response = await fetch(sampleUrl(sample.file));
    if (!response.ok) throw new Error("Couldn’t open that sample. Try another, or choose your own picture.");
    const blob = await response.blob();
    return { file: new File([blob], sample.file, { type: blob.type || "image/jpeg" }) };
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  drawSample(sample.id, canvas);
  const data = canvas.getContext("2d")?.getImageData(0, 0, W, H);
  if (!data) throw new Error("Couldn’t draw the sample.");
  return { pixels: { width: W, height: H, data: data.data } };
}
