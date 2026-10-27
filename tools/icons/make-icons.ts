// Generates the extension icons without any image library: a red disc with a
// white diagonal bar (the universal "blocked" sign), rendered with 4x
// supersampling and written as PNG through Node's zlib.
//
//   node tools/icons/make-icons.ts
//
// Writes public/icon/{16,32,48,96,128}.png (picked up by WXT) and store/icon-512.png.

import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync, crc32 } from "node:zlib";

const DISC = [0xd1, 0x1a, 0x2a];
const BAR = [0xff, 0xff, 0xff];
const SS = 4;

function render(size: number): Uint8Array {
  const px = new Uint8Array(size * size * 4);
  const n = size * SS;
  const c = n / 2;
  const r = n * 0.47;
  const half = n * 0.085; // half thickness of the bar
  const len = n * 0.31; // half length of the bar
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 0, rr = 0, gg = 0, bb = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const X = x * SS + sx + 0.5 - c;
          const Y = y * SS + sy + 0.5 - c;
          if (X * X + Y * Y > r * r) continue;
          // bar from top-left to bottom-right: distance to the line y = x
          const d = Math.abs(X - Y) / Math.SQRT2;
          const along = Math.abs(X + Y) / Math.SQRT2;
          const onBar = d <= half && along <= len;
          const col = onBar ? BAR : DISC;
          rr += col[0]!; gg += col[1]!; bb += col[2]!; a++;
        }
      }
      const i = (y * size + x) * 4;
      if (a === 0) continue;
      px[i] = Math.round(rr / a);
      px[i + 1] = Math.round(gg / a);
      px[i + 2] = Math.round(bb / a);
      px[i + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return px;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function png(size: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    raw.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

await mkdir("public/icon", { recursive: true });
await mkdir("store", { recursive: true });
for (const size of [16, 32, 48, 96, 128]) await writeFile(`public/icon/${size}.png`, png(size, render(size)));
await writeFile("store/icon-512.png", png(512, render(512)));
console.log("icons written");
