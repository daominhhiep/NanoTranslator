import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  throw new Error("Usage: node scripts/remove-icon-background.mjs <input.png> <output.png>");
}

const png = readFileSync(inputPath);
const signature = png.subarray(0, 8);
const expectedSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return c >>> 0;
});
if (!signature.equals(expectedSignature)) {
  throw new Error("Unsupported file: not a PNG");
}

let offset = 8;
let width = 0;
let height = 0;
let bitDepth = 0;
let colorType = 0;
let compressed = Buffer.alloc(0);

while (offset < png.length) {
  const length = png.readUInt32BE(offset);
  offset += 4;
  const type = png.subarray(offset, offset + 4).toString("ascii");
  offset += 4;
  const data = png.subarray(offset, offset + length);
  offset += length + 4;

  if (type === "IHDR") {
    width = data.readUInt32BE(0);
    height = data.readUInt32BE(4);
    bitDepth = data[8];
    colorType = data[9];
  } else if (type === "IDAT") {
    compressed = Buffer.concat([compressed, data]);
  } else if (type === "IEND") {
    break;
  }
}

if (bitDepth !== 8 || colorType !== 2) {
  throw new Error(`Unsupported PNG format: bitDepth=${bitDepth} colorType=${colorType}`);
}

const bytesPerPixel = 3;
const stride = width * bytesPerPixel;
const inflated = inflateSync(compressed);
const rows = [];

for (let y = 0; y < height; y += 1) {
  const rowOffset = y * (stride + 1);
  const filterType = inflated[rowOffset];
  const row = Buffer.from(inflated.subarray(rowOffset + 1, rowOffset + 1 + stride));
  const prevRow = y > 0 ? rows[y - 1] : null;
  unfilterRow(row, prevRow, filterType, bytesPerPixel);
  rows.push(row);
}

const pixels = new Uint8Array(width * height * 4);
for (let y = 0; y < height; y += 1) {
  const row = rows[y];
  for (let x = 0; x < width; x += 1) {
    const src = x * 3;
    const dst = (y * width + x) * 4;
    pixels[dst] = row[src];
    pixels[dst + 1] = row[src + 1];
    pixels[dst + 2] = row[src + 2];
    pixels[dst + 3] = 255;
  }
}

removeConnectedBackground(pixels, width, height);
const output = encodePngRgba(pixels, width, height);
writeFileSync(outputPath, output);

function removeConnectedBackground(rgba, imageWidth, imageHeight) {
  const queue = [];
  const visited = new Uint8Array(imageWidth * imageHeight);

  const enqueue = (x, y) => {
    if (x < 0 || x >= imageWidth || y < 0 || y >= imageHeight) {
      return;
    }
    const index = y * imageWidth + x;
    if (visited[index]) {
      return;
    }
    visited[index] = 1;
    queue.push(index);
  };

  for (let x = 0; x < imageWidth; x += 1) {
    enqueue(x, 0);
    enqueue(x, imageHeight - 1);
  }
  for (let y = 1; y < imageHeight - 1; y += 1) {
    enqueue(0, y);
    enqueue(imageWidth - 1, y);
  }

  while (queue.length > 0) {
    const index = queue.shift();
    if (index === undefined) {
      continue;
    }
    const offset = index * 4;
    const r = rgba[offset];
    const g = rgba[offset + 1];
    const b = rgba[offset + 2];
    if (!isBackgroundPixel(r, g, b)) {
      continue;
    }

    rgba[offset + 3] = 0;
    const x = index % imageWidth;
    const y = Math.floor(index / imageWidth);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }
}

function isBackgroundPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = (r + g + b) / 3;
  return brightness >= 238 && max - min <= 22;
}

function encodePngRgba(rgba, imageWidth, imageHeight) {
  const raw = Buffer.alloc((imageWidth * 4 + 1) * imageHeight);
  for (let y = 0; y < imageHeight; y += 1) {
    const rowOffset = y * (imageWidth * 4 + 1);
    raw[rowOffset] = 0;
    const start = y * imageWidth * 4;
    Buffer.from(rgba.subarray(start, start + imageWidth * 4)).copy(raw, rowOffset + 1);
  }

  const idat = deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(imageWidth, 0);
  ihdr.writeUInt32BE(imageHeight, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    expectedSignature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuffer.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(computeCrc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return out;
}

function unfilterRow(row, prevRow, filterType, bpp) {
  switch (filterType) {
    case 0:
      return;
    case 1:
      for (let i = bpp; i < row.length; i += 1) {
        row[i] = (row[i] + row[i - bpp]) & 255;
      }
      return;
    case 2:
      if (!prevRow) {
        return;
      }
      for (let i = 0; i < row.length; i += 1) {
        row[i] = (row[i] + prevRow[i]) & 255;
      }
      return;
    case 3:
      for (let i = 0; i < row.length; i += 1) {
        const left = i >= bpp ? row[i - bpp] : 0;
        const up = prevRow ? prevRow[i] : 0;
        row[i] = (row[i] + Math.floor((left + up) / 2)) & 255;
      }
      return;
    case 4:
      for (let i = 0; i < row.length; i += 1) {
        const left = i >= bpp ? row[i - bpp] : 0;
        const up = prevRow ? prevRow[i] : 0;
        const upLeft = prevRow && i >= bpp ? prevRow[i - bpp] : 0;
        row[i] = (row[i] + paeth(left, up, upLeft)) & 255;
      }
      return;
    default:
      throw new Error(`Unsupported PNG filter type: ${filterType}`);
  }
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  if (pb <= pc) {
    return b;
  }
  return c;
}

function computeCrc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
