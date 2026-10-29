/** The EXIF orientation (1 to 8) of a JPEG, or 1 if it has none. Phones store photos sideways with a note saying how to turn them. */
export function exifOrientation(buf: Uint8Array): number {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return 1;
  let p = 2;
  while (p + 4 < buf.length) {
    if (buf[p] !== 0xff) return 1;
    const marker = buf[p + 1] as number;
    const len = ((buf[p + 2] as number) << 8) | (buf[p + 3] as number);
    if (marker === 0xe1 && buf[p + 4] === 0x45 && buf[p + 5] === 0x78 && buf[p + 6] === 0x69 && buf[p + 7] === 0x66) {
      const t = p + 10; // start of the TIFF header
      const little = buf[t] === 0x49;
      const u16 = (o: number) => (little ? (buf[o] as number) | ((buf[o + 1] as number) << 8) : ((buf[o] as number) << 8) | (buf[o + 1] as number));
      const u32 = (o: number) => (little ? u16(o) | (u16(o + 2) << 16) : (u16(o) << 16) | u16(o + 2));
      const ifd = t + u32(t + 4);
      const count = u16(ifd);
      for (let i = 0; i < count; i++) {
        const e = ifd + 2 + i * 12;
        if (u16(e) === 0x0112) {
          const v = u16(e + 8);
          return v >= 1 && v <= 8 ? v : 1;
        }
      }
      return 1;
    }
    if (marker === 0xda) return 1; // start of the picture data: no EXIF before it
    p += 2 + len;
  }
  return 1;
}
