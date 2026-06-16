const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, checksum]);
}

function createCanvas(width, height) {
  return {
    width,
    height,
    pixels: Buffer.alloc(width * height * 4)
  };
}

function blendPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
    return;
  }
  const index = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  const alpha = (color[3] ?? 255) / 255;
  const inverse = 1 - alpha;
  canvas.pixels[index] = Math.round(color[0] * alpha + canvas.pixels[index] * inverse);
  canvas.pixels[index + 1] = Math.round(
    color[1] * alpha + canvas.pixels[index + 1] * inverse
  );
  canvas.pixels[index + 2] = Math.round(
    color[2] * alpha + canvas.pixels[index + 2] * inverse
  );
  canvas.pixels[index + 3] = Math.round(
    255 * (alpha + (canvas.pixels[index + 3] / 255) * inverse)
  );
}

function ellipse(canvas, centerX, centerY, radiusX, radiusY, color) {
  for (let y = Math.floor(centerY - radiusY); y <= centerY + radiusY; y += 1) {
    for (let x = Math.floor(centerX - radiusX); x <= centerX + radiusX; x += 1) {
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      if (dx * dx + dy * dy <= 1) {
        blendPixel(canvas, x, y, color);
      }
    }
  }
}

function line(canvas, x1, y1, x2, y2, width, color) {
  const distance = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let step = 0; step <= distance; step += 1) {
    const ratio = distance === 0 ? 0 : step / distance;
    const x = x1 + (x2 - x1) * ratio;
    const y = y1 + (y2 - y1) * ratio;
    ellipse(canvas, x, y, width / 2, width / 2, color);
  }
}

function triangle(canvas, points, color) {
  const minX = Math.floor(Math.min(...points.map(([x]) => x)));
  const maxX = Math.ceil(Math.max(...points.map(([x]) => x)));
  const minY = Math.floor(Math.min(...points.map(([, y]) => y)));
  const maxY = Math.ceil(Math.max(...points.map(([, y]) => y)));
  const [[x1, y1], [x2, y2], [x3, y3]] = points;
  const denominator = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / denominator;
      const b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / denominator;
      const c = 1 - a - b;
      if (a >= 0 && b >= 0 && c >= 0) {
        blendPixel(canvas, x, y, color);
      }
    }
  }
}

function writePng(filePath, canvas) {
  const rows = [];
  for (let y = 0; y < canvas.height; y += 1) {
    rows.push(Buffer.from([0]));
    const offset = y * canvas.width * 4;
    rows.push(canvas.pixels.subarray(offset, offset + canvas.width * 4));
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(canvas.width, 0);
  header.writeUInt32BE(canvas.height, 4);
  header[8] = 8;
  header[9] = 6;

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, png);
}

function drawMascot(palette, state) {
  const canvas = createCanvas(256, 300);
  const outline = palette.outline;

  // 地面の影
  ellipse(canvas, 128, 278, 72, 13, [32, 27, 22, 42]);

  // 耳、胴体、頭を重ねて、丸いマスコットを描きます。
  triangle(canvas, [[54, 91], [72, 34], [102, 76]], outline);
  triangle(canvas, [[154, 76], [184, 34], [202, 91]], outline);
  triangle(canvas, [[61, 87], [74, 48], [94, 78]], palette.inner);
  triangle(canvas, [[162, 78], [182, 48], [195, 87]], palette.inner);
  ellipse(canvas, 128, 205, 78, 80, outline);
  ellipse(canvas, 128, 205, 71, 73, palette.body);
  ellipse(canvas, 128, 126, 91, 82, outline);
  ellipse(canvas, 128, 126, 84, 75, palette.head);
  ellipse(canvas, 128, 150, 53, 42, palette.muzzle);

  // 足と腕
  ellipse(canvas, 84, 260, 31, 18, outline);
  ellipse(canvas, 172, 260, 31, 18, outline);
  ellipse(canvas, 84, 257, 25, 12, palette.muzzle);
  ellipse(canvas, 172, 257, 25, 12, palette.muzzle);
  line(canvas, 64, 192, 35, 215, 18, outline);
  line(canvas, 192, 192, 221, 214, 18, outline);
  line(canvas, 65, 192, 38, 212, 12, palette.body);
  line(canvas, 191, 192, 218, 212, 12, palette.body);

  // 状態ごとに表情を変えます。
  if (state === 'click') {
    line(canvas, 82, 111, 101, 112, 7, outline);
    ellipse(canvas, 164, 112, 8, 12, outline);
    ellipse(canvas, 86, 145, 15, 8, [242, 119, 124, 125]);
    ellipse(canvas, 170, 145, 15, 8, [242, 119, 124, 125]);
    line(canvas, 112, 158, 128, 168, 5, outline);
    line(canvas, 128, 168, 145, 156, 5, outline);
    ellipse(canvas, 213, 80, 10, 10, [230, 78, 94, 255]);
    ellipse(canvas, 228, 80, 10, 10, [230, 78, 94, 255]);
    triangle(canvas, [[205, 84], [236, 84], [220, 105]], [230, 78, 94, 255]);
  } else if (state === 'alarm') {
    ellipse(canvas, 91, 112, 10, 13, outline);
    ellipse(canvas, 165, 112, 10, 13, outline);
    ellipse(canvas, 128, 160, 18, 22, outline);
    ellipse(canvas, 128, 160, 11, 14, [180, 54, 53, 255]);
    ellipse(canvas, 214, 55, 23, 23, [215, 67, 48, 255]);
    line(canvas, 214, 43, 214, 58, 7, [255, 255, 255, 255]);
    ellipse(canvas, 214, 66, 4, 4, [255, 255, 255, 255]);
  } else {
    ellipse(canvas, 91, 112, 8, 12, outline);
    ellipse(canvas, 165, 112, 8, 12, outline);
    line(canvas, 116, 159, 128, 164, 4, outline);
    line(canvas, 128, 164, 140, 159, 4, outline);
  }

  ellipse(canvas, 128, 137, 7, 5, outline);
  ellipse(canvas, 105, 204, 13, 17, palette.accent);
  ellipse(canvas, 151, 204, 13, 17, palette.accent);
  return canvas;
}

function drawTrayIcon() {
  const canvas = createCanvas(32, 32);
  ellipse(canvas, 16, 17, 14, 13, [48, 44, 39, 255]);
  ellipse(canvas, 16, 17, 11, 10, [247, 201, 72, 255]);
  ellipse(canvas, 12, 15, 2, 3, [48, 44, 39, 255]);
  ellipse(canvas, 20, 15, 2, 3, [48, 44, 39, 255]);
  line(canvas, 12, 21, 16, 23, 2, [48, 44, 39, 255]);
  line(canvas, 16, 23, 21, 20, 2, [48, 44, 39, 255]);
  return canvas;
}

const characters = {
  Chara1: {
    outline: [55, 49, 42, 255],
    head: [248, 199, 70, 255],
    body: [242, 180, 55, 255],
    muzzle: [255, 240, 196, 255],
    inner: [226, 121, 72, 255],
    accent: [226, 121, 72, 255]
  },
  Chara2: {
    outline: [39, 51, 68, 255],
    head: [108, 177, 216, 255],
    body: [78, 151, 196, 255],
    muzzle: [226, 244, 248, 255],
    inner: [117, 102, 174, 255],
    accent: [117, 102, 174, 255]
  }
};

for (const [characterName, palette] of Object.entries(characters)) {
  for (const state of ['wait', 'click', 'alarm']) {
    writePng(
      path.join(__dirname, 'Chara', characterName, `${state}.png`),
      drawMascot(palette, state)
    );
  }
}
writePng(path.join(__dirname, 'assets', 'tray-icon.png'), drawTrayIcon());
console.log('Generated TaskMate character and tray PNG files.');
