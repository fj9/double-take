import type { Pixels } from "@doubletake/core";

/**
 * Sample pictures. Most are small copies of free Pixabay pictures (Pixabay Content Licence, credited below and in
 * `public/samples/NOTICE.md`). "Bands" is drawn in code and has no source. Each is a few flat colours, the kind
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
  { id: "leopard", name: "Leopard", blurb: "Four colours. Good for duplicate stitch.", file: "leopard.jpg", credit: { by: "missperfectkaos", url: pixabay(4852724) } },
  { id: "skulls", name: "Skulls", blurb: "Two colours and bold shapes.", file: "skulls.jpg", credit: { by: "anastasia_makarevich", url: pixabay(4645914) } },
  { id: "zebra", name: "Zebra", blurb: "Black and white stripes that flow.", file: "zebra.jpg", credit: { by: "prawny", url: pixabay(1315322) } },
  { id: "giraffe", name: "Giraffe", blurb: "Warm patches with pale lines.", file: "giraffe.jpg", credit: { by: "scarletcat", url: pixabay(7251950) } },
  { id: "wave", name: "Great Wave", blurb: "A picture with a clear subject.", file: "wave.jpg", credit: { by: "Loke_Artemis", url: pixabay(7107112) } },
  { id: "bands", name: "Bands", blurb: "Five colours in layers. Good for stripes.", file: null },
];

const W = 640;
const H = 320;

/** Draw a sample that is drawn in code (the picture ones are files) on a canvas of any size. */
export function drawSample(id: string, canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx || id !== "bands") return;
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  const bands: [string, number][] = [["#1c2f5a", 70], ["#f1e8d0", 30], ["#c4472f", 50], ["#e5b53a", 36], ["#2f7f78", 60], ["#f1e8d0", 24], ["#1c2f5a", 50]];
  let y = 0;
  for (const [c, h] of bands) {
    ctx.fillStyle = c;
    ctx.fillRect(0, y, W, h + 1);
    y += h;
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
