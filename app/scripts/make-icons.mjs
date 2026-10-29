// Placeholder app icons: two overlapping discs on midnight ("double take"). Replace with the real icon later.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
const MIDNIGHT = [0x1b, 0x2a, 0x41], CORAL = [0xf2, 0x6b, 0x5b], PAPER = [0xe8, 0xed, 0xf5];

function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, scale) {
  // scale < 1 keeps the artwork inside the maskable safe zone
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const r = size * 0.24 * scale, cy = size / 2;
  const discs = [[size / 2 - r * 0.62, CORAL], [size / 2 + r * 0.62, PAPER]];
  const SS = 3;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let rgb = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
        let col = MIDNIGHT;
        for (const [cx, c] of discs) if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) col = c;
        rgb = rgb.map((v, i) => v + col[i]);
      }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(rgb[i] / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

writeFileSync(out("icon-192.png"), png(192, 1));
writeFileSync(out("icon-512.png"), png(512, 1));
writeFileSync(out("icon-maskable-512.png"), png(512, 0.8));
writeFileSync(out("apple-touch-icon.png"), png(180, 1));
writeFileSync(out("icon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#1b2a41"/><circle cx="212" cy="256" r="123" fill="#f26b5b"/><circle cx="300" cy="256" r="123" fill="#e8edf5"/></svg>\n`);
console.log("icons written");
