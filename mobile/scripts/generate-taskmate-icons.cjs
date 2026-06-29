const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const CHARACTER_PATH = path.join(ROOT, 'assets', 'characters', 'Chara1', 'wait.png');
const PROPOSAL_DIR = path.join(ROOT, 'assets', 'icon-proposals');

const palette = {
  background: '#F3F8F1',
  backgroundSoft: '#E8F2E5',
  white: '#FFFFFF',
  primary: '#2F633D',
  primaryDark: '#1F4B2E',
  text: '#1F2F25',
  accent: '#F5C94C',
  blush: '#E9804F'
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function hexToRgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    alpha
  ];
}

function createCanvas(size, fill = null) {
  const png = new PNG({ width: size, height: size });
  if (fill) {
    const [r, g, b, a] = hexToRgba(fill);
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = a;
    }
  }
  return png;
}

function setPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const index = (png.width * y + x) << 2;
  const sourceA = color[3] / 255;
  const targetA = png.data[index + 3] / 255;
  const outA = sourceA + targetA * (1 - sourceA);
  if (outA <= 0) return;
  for (let channel = 0; channel < 3; channel += 1) {
    png.data[index + channel] = Math.round(
      (color[channel] * sourceA + png.data[index + channel] * targetA * (1 - sourceA)) / outA
    );
  }
  png.data[index + 3] = Math.round(outA * 255);
}

function fillCircle(png, cx, cy, radius, color) {
  const rgba = Array.isArray(color) ? color : hexToRgba(color);
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(png, x, y, rgba);
      }
    }
  }
}

function fillRoundedRect(png, x, y, width, height, radius, color) {
  const rgba = Array.isArray(color) ? color : hexToRgba(color);
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      const dx = px < x + radius ? x + radius - px : px >= x + width - radius ? px - (x + width - radius - 1) : 0;
      const dy = py < y + radius ? y + radius - py : py >= y + height - radius ? py - (y + height - radius - 1) : 0;
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(png, px, py, rgba);
      }
    }
  }
}

function strokeLine(png, x1, y1, x2, y2, width, color) {
  const rgba = Array.isArray(color) ? color : hexToRgba(color);
  const minX = Math.floor(Math.min(x1, x2) - width);
  const maxX = Math.ceil(Math.max(x1, x2) + width);
  const minY = Math.floor(Math.min(y1, y2) - width);
  const maxY = Math.ceil(Math.max(y1, y2) + width);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSq));
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      const distSq = (x - px) * (x - px) + (y - py) * (y - py);
      if (distSq <= (width / 2) * (width / 2)) {
        setPixel(png, x, y, rgba);
      }
    }
  }
  fillCircle(png, x1, y1, width / 2, rgba);
  fillCircle(png, x2, y2, width / 2, rgba);
}

function resizeNearest(source, targetWidth, targetHeight) {
  const target = new PNG({ width: targetWidth, height: targetHeight });
  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sx = Math.min(source.width - 1, Math.floor((x / targetWidth) * source.width));
      const sy = Math.min(source.height - 1, Math.floor((y / targetHeight) * source.height));
      const sourceIndex = (source.width * sy + sx) << 2;
      const targetIndex = (target.width * y + x) << 2;
      target.data[targetIndex] = source.data[sourceIndex];
      target.data[targetIndex + 1] = source.data[sourceIndex + 1];
      target.data[targetIndex + 2] = source.data[sourceIndex + 2];
      target.data[targetIndex + 3] = source.data[sourceIndex + 3];
    }
  }
  return target;
}

function composite(base, overlay, offsetX, offsetY) {
  for (let y = 0; y < overlay.height; y += 1) {
    for (let x = 0; x < overlay.width; x += 1) {
      const index = (overlay.width * y + x) << 2;
      const rgba = [
        overlay.data[index],
        overlay.data[index + 1],
        overlay.data[index + 2],
        overlay.data[index + 3]
      ];
      if (rgba[3] > 0) {
        setPixel(base, offsetX + x, offsetY + y, rgba);
      }
    }
  }
}

function writePng(filePath, png) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

function drawCheck(png, x, y, scale, color = palette.primary) {
  strokeLine(png, x, y + 48 * scale, x + 40 * scale, y + 86 * scale, 20 * scale, color);
  strokeLine(png, x + 40 * scale, y + 86 * scale, x + 118 * scale, y, 20 * scale, color);
}

function drawSpeechBubble(png, x, y, width, height) {
  fillRoundedRect(png, x + 8, y + 8, width, height, 56, hexToRgba('#D7E5D2', 105));
  fillRoundedRect(png, x, y, width, height, 56, palette.white);
  fillRoundedRect(png, x + 24, y + height - 16, 92, 72, 22, palette.white);
}

const character = PNG.sync.read(fs.readFileSync(CHARACTER_PATH));

function proposalCharacter(size = 1024) {
  const png = createCanvas(size, palette.background);
  fillCircle(png, size * 0.5, size * 0.48, size * 0.34, hexToRgba(palette.backgroundSoft, 210));
  fillCircle(png, size * 0.33, size * 0.31, size * 0.095, hexToRgba('#D9EAD3', 150));
  const chara = resizeNearest(character, Math.round(size * 0.52), Math.round(size * 0.61));
  composite(png, chara, Math.round(size * 0.24), Math.round(size * 0.21));
  fillCircle(png, size * 0.73, size * 0.72, size * 0.12, palette.white);
  drawCheck(png, size * 0.67, size * 0.67, size / 1024, palette.primary);
  return png;
}

function proposalCheck(size = 1024) {
  const png = createCanvas(size, palette.background);
  fillRoundedRect(png, 170, 220, 680, 520, 130, palette.white);
  drawCheck(png, 300, 388, 2.25, palette.primary);
  const chara = resizeNearest(character, 300, 352);
  composite(png, chara, 72, 520);
  fillCircle(png, 742, 300, 46, hexToRgba(palette.accent, 230));
  return png;
}

function proposalBubble(size = 1024) {
  const png = createCanvas(size, palette.background);
  drawSpeechBubble(png, 142, 180, 740, 430);
  const chara = resizeNearest(character, 360, 422);
  composite(png, chara, 332, 345);
  drawCheck(png, 420, 298, 1.2, palette.primary);
  return png;
}

function foreground(size = 512) {
  const png = createCanvas(size);
  const chara = resizeNearest(character, Math.round(size * 0.58), Math.round(size * 0.68));
  composite(png, chara, Math.round(size * 0.20), Math.round(size * 0.13));
  fillCircle(png, size * 0.73, size * 0.73, size * 0.11, palette.white);
  drawCheck(png, size * 0.675, size * 0.685, size / 1024, palette.primary);
  return png;
}

function background(size = 512) {
  const png = createCanvas(size, palette.background);
  fillCircle(png, size * 0.5, size * 0.48, size * 0.33, hexToRgba(palette.backgroundSoft, 210));
  fillCircle(png, size * 0.34, size * 0.30, size * 0.085, hexToRgba('#D9EAD3', 130));
  return png;
}

function monochrome(size = 432) {
  const png = createCanvas(size);
  fillCircle(png, size * 0.5, size * 0.46, size * 0.22, '#000000');
  fillCircle(png, size * 0.39, size * 0.29, size * 0.075, '#000000');
  fillCircle(png, size * 0.61, size * 0.29, size * 0.075, '#000000');
  drawCheck(png, size * 0.60, size * 0.64, size / 1024, '#000000');
  return png;
}

function scalePng(png, size) {
  return resizeNearest(png, size, size);
}

function clearLauncherWebpFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const fileName of fs.readdirSync(dir)) {
    if (/^ic_launcher.*\.webp$/.test(fileName)) {
      fs.unlinkSync(path.join(dir, fileName));
    }
  }
}

ensureDir(PROPOSAL_DIR);
writePng(path.join(PROPOSAL_DIR, 'proposal-1-character.png'), proposalCharacter());
writePng(path.join(PROPOSAL_DIR, 'proposal-2-check-character.png'), proposalCheck());
writePng(path.join(PROPOSAL_DIR, 'proposal-3-bubble-character.png'), proposalBubble());

const adopted = proposalCharacter();
writePng(path.join(ROOT, 'assets', 'icon.png'), adopted);
writePng(path.join(ROOT, 'assets', 'splash-icon.png'), background(1024));
writePng(path.join(ROOT, 'assets', 'android-icon-background.png'), background(512));
writePng(path.join(ROOT, 'assets', 'android-icon-foreground.png'), foreground(512));
writePng(path.join(ROOT, 'assets', 'android-icon-monochrome.png'), monochrome(432));

// The checked-in native Android folder is generated by Expo, but the current APK
// is built from it directly. Mirror the selected icon there so release builds use it.
const mipmapSizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192
};
const adaptiveSizes = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432
};

for (const [density, size] of Object.entries(mipmapSizes)) {
  const dir = path.join(ROOT, 'android', 'app', 'src', 'main', 'res', `mipmap-${density}`);
  ensureDir(dir);
  clearLauncherWebpFiles(dir);
  writePng(path.join(dir, 'ic_launcher.png'), scalePng(adopted, size));
  writePng(path.join(dir, 'ic_launcher_round.png'), scalePng(adopted, size));
}

for (const [density, size] of Object.entries(adaptiveSizes)) {
  const dir = path.join(ROOT, 'android', 'app', 'src', 'main', 'res', `mipmap-${density}`);
  writePng(path.join(dir, 'ic_launcher_background.png'), scalePng(background(size), size));
  writePng(path.join(dir, 'ic_launcher_foreground.png'), scalePng(foreground(size), size));
  writePng(path.join(dir, 'ic_launcher_monochrome.png'), scalePng(monochrome(size), size));
}

console.log('Generated TaskMate app icon proposals and Android launcher assets.');
