// news-image-20261120 round 4: "The World - Friday, 20 November 2026"
// Hand-drawn 1024x1024 news image. Node 22 stdlib only (fs, path, zlib).
// Three layouts, picked with VARIANT=a|b|c (default: a). Deterministic:
// the same run always writes byte-identical entry.png.
//   MAKEFUN_OUTPUT_DIR=out VARIANT=a node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
type RGB = [number, number, number];
const PAPER: RGB = [247, 241, 222];
const INK: RGB = [20, 33, 61];
const RED: RGB = [180, 35, 24];
const NAVY: RGB = [27, 42, 74];
const SKY: RGB = [191, 217, 232];
const GOLD: RGB = [201, 162, 39];
const GREEN: RGB = [34, 120, 74];
const WHITE: RGB = [255, 255, 255];
const GREY: RGB = [90, 96, 110];
const LIGHT: RGB = [226, 232, 240];
const TEAL: RGB = [14, 116, 144];

// ---------------------------------------------------------------- canvas
const px = new Uint8Array(W * H * 3);
function setPix(x: number, y: number, c: RGB): void {
  const xi = Math.round(x); const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setPix(i, j, c);
}
function rect(x: number, y: number, w: number, h: number, c: RGB, t = 2): void {
  fillRect(x, y, w, t, c); fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c); fillRect(x + w - t, y, t, h, c);
}
function hline(x: number, y: number, w: number, c: RGB, t = 2): void {
  fillRect(x, y, w, t, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 2): void {
  const dx = x1 - x0; const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + (dx * s) / steps);
    const y = Math.round(y0 + (dy * s) / steps);
    for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) setPix(x + a, y + b, c);
  }
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    const dy = y - cy;
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let x = cx - half; x <= cx + half; x++) setPix(x, y, c);
  }
}
function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  for (let y = cy - ry; y <= cy + ry; y++) {
    const dy = (y - cy) / ry;
    const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - dy * dy)));
    for (let x = cx - half; x <= cx + half; x++) setPix(x, y, c);
  }
}
function fillTri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.min(x0, x1, x2); const maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2); const maxY = Math.max(y0, y1, y2);
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
    const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
    const g = 1 - a - b;
    if (a >= 0 && b >= 0 && g >= 0) setPix(x, y, c);
  }
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 cells, '#' = ink, '.' = blank. Hand-made.
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '..#..', '..#..', '.#.#.', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.#.#.', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '%': ['#...#', '#..#.', '...#.', '..#..', '.#...', '#..#.', '#...#'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '&': ['.##..', '#..#.', '#..#.', '.#...', '#.#.#', '#..#.', '.##.#'],
  '/': ['....#', '....#', '...#.', '...#.', '..#..', '.#...', '#....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '*': ['.....', '.#.#.', '..#..', '#####', '..#..', '.#.#.', '.....'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '|': ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
};
function textW(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  const up = s.toUpperCase();
  let cx = x;
  for (const ch of up) {
    const g = FONT[ch] ?? FONT['?'];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
      if (g[r][col] === '#') fillRect(cx + col * scale, y + r * scale, scale, scale, c);
    }
    cx += 6 * scale;
  }
}
function drawTextC(s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(s, cx - Math.floor(textW(s, scale) / 2), y, scale, c);
}
function wrap(text: string, scale: number, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur === '' ? w : cur + ' ' + w;
    if (textW(trial, scale) <= maxW || cur === '') cur = trial;
    else { lines.push(cur); cur = w; }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}
function drawPara(text: string, x: number, y: number, scale: number, maxW: number, c: RGB, lh?: number): number {
  const lines = wrap(text, scale, maxW);
  const step = lh ?? Math.round(9 * scale);
  lines.forEach((ln, i) => drawText(ln, x, y + i * step, scale, c));
  return y + lines.length * step;
}

// ---------------------------------------------------------------- scenes
function drawGlobe(cx: number, cy: number, r: number): void {
  fillCircle(cx, cy, r, [58, 130, 190]);
  fillEllipse(cx - r * 0.35, cy - r * 0.25, r * 0.42, r * 0.3, GREEN);
  fillEllipse(cx + r * 0.4, cy + r * 0.3, r * 0.38, r * 0.26, GREEN);
  fillEllipse(cx + r * 0.45, cy - r * 0.45, r * 0.22, r * 0.16, GREEN);
  // latitude rings
  for (let k = -1; k <= 1; k++) {
    const yy = cy + Math.round(k * r * 0.45);
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - (yy - cy) * (yy - cy))));
    hline(cx - half, yy, half * 2, WHITE, 2);
  }
  // meridian
  for (let k = -1; k <= 1; k++) {
    const xx = cx + Math.round(k * r * 0.45);
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - (xx - cx) * (xx - cx))));
    fillRect(xx - 1, cy - half, 2, half * 2, WHITE);
  }
  // outline
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    setPix(cx + Math.round(r * Math.cos(rad)), cy + Math.round(r * Math.sin(rad)), NAVY);
    setPix(cx + Math.round((r - 1) * Math.cos(rad)), cy + Math.round((r - 1) * Math.sin(rad)), NAVY);
  }
}
function drawFlagUS(x: number, y: number, w: number, h: number): void {
  for (let i = 0; i < 7; i++) fillRect(x, y + Math.floor((i * h) / 7), w, Math.ceil(h / 7), i % 2 === 0 ? RED : WHITE);
  fillRect(x, y, Math.floor(w * 0.4), Math.floor(h * 0.55), NAVY);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++)
    fillRect(x + 4 + c * 9, y + 4 + r * 8, 3, 3, WHITE);
  rect(x, y, w, h, INK, 2);
}
function drawFlagCN(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, RED);
  fillCircle(x + 14, y + 14, 7, GOLD);
  fillCircle(x + 30, y + 8, 3, GOLD);
  fillCircle(x + 36, y + 18, 3, GOLD);
  fillCircle(x + 32, y + 30, 3, GOLD);
  rect(x, y, w, h, INK, 2);
}
function drawFlagRU(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, Math.floor(h / 3), WHITE);
  fillRect(x, y + Math.floor(h / 3), w, Math.floor(h / 3), [0, 90, 180]);
  fillRect(x, y + Math.floor((2 * h) / 3), w, h - Math.floor((2 * h) / 3), RED);
  rect(x, y, w, h, INK, 2);
}
function drawFlagPole(x: number, y: number, w: number, h: number, kind: 'us' | 'cn' | 'ru'): void {
  fillRect(x + Math.floor(w / 2) - 2, y + h, 4, 26, INK);
  if (kind === 'us') drawFlagUS(x, y, w, h);
  else if (kind === 'cn') drawFlagCN(x, y, w, h);
  else drawFlagRU(x, y, w, h);
}
function drawFigure(x: number, y: number, s: number, skin: RGB, suit: RGB, tie: RGB): void {
  // x,y = centre of head; s = head radius
  fillCircle(x, y, s, skin);
  fillRect(x - Math.floor(s * 1.5), y + s, Math.floor(s * 3), Math.floor(s * 2.6), suit);
  fillRect(x - 4, y + s + 2, 8, Math.floor(s * 2.2), WHITE);
  fillTri(x - 5, y + s + 4, x + 5, y + s + 4, x, y + s + Math.floor(s * 2.2), tie);
}
function drawScales(cx: number, cy: number, s: number, c: RGB): void {
  // balance scales, s = half-width
  line(cx, cy - s, cx, cy + s, c, 4);
  line(cx - s, cy - Math.floor(s * 0.55), cx + s, cy - Math.floor(s * 0.55), c, 4);
  fillCircle(cx, cy - s - 4, 5, c);
  line(cx - s, cy - Math.floor(s * 0.55), cx - s, cy, c, 3);
  line(cx + s, cy - Math.floor(s * 0.55), cx + s, cy, c, 3);
  fillTri(cx - s - 16, cy, cx - s + 16, cy, cx - s, cy + 18, c);
  fillTri(cx + s - 16, cy, cx + s + 16, cy, cx + s, cy + 18, c);
  fillRect(cx - 22, cy + s, 44, 6, c);
}
function drawChart(cx: number, cy: number, w: number, h: number, up: boolean, c: RGB): void {
  line(cx - w / 2, cy + h / 2, cx + w / 2, cy + h / 2, INK, 3);
  line(cx - w / 2, cy - h / 2, cx - w / 2, cy + h / 2, INK, 3);
  const pts: [number, number][] = up
    ? [[-0.45, 0.35], [-0.2, 0.1], [0.05, 0.2], [0.3, -0.25], [0.48, -0.4]]
    : [[-0.45, -0.35], [-0.2, -0.1], [0.05, -0.2], [0.3, 0.25], [0.48, 0.4]];
  for (let i = 0; i < pts.length - 1; i++) {
    line(
      Math.round(cx + pts[i][0] * w), Math.round(cy + pts[i][1] * h),
      Math.round(cx + pts[i + 1][0] * w), Math.round(cy + pts[i + 1][1] * h), c, 5,
    );
  }
  const ex = Math.round(cx + 0.48 * w); const ey = Math.round(cy + pts[4][1] * h);
  if (up) fillTri(ex - 12, ey + 2, ex + 2, ey + 2, ex - 2, ey - 14, c);
  else fillTri(ex - 12, ey - 2, ex + 2, ey - 2, ex - 2, ey + 14, c);
}
function drawTower(cx: number, baseY: number, h: number, c: RGB): void {
  const w = 44;
  fillRect(cx - w / 2, baseY - h, w, h, c);
  fillTri(cx - w / 2 - 8, baseY - h, cx + w / 2 + 8, baseY - h, cx, baseY - h - 26, c);
  for (let r = 0; r < 5; r++) for (let col = 0; col < 3; col++)
    fillRect(cx - 15 + col * 12, baseY - h + 18 + r * 16, 7, 8, GOLD);
}
function drawMissile(x0: number, y0: number, x1: number, y1: number): void {
  line(x0, y0, x1, y1, RED, 6);
  fillCircle(x1, y1, 7, RED);
  // burst
  for (let a = 0; a < 8; a++) {
    const rad = (a * Math.PI) / 4;
    line(x1, y1, x1 + Math.round(20 * Math.cos(rad)), y1 + Math.round(20 * Math.sin(rad)), GOLD, 3);
  }
  fillCircle(x1, y1, 10, GOLD);
}

// ---------------------------------------------------------------- variant A
function drawA(): void {
  fillRect(0, 0, W, H, PAPER);
  // masthead
  drawTextC('THE WORLD', 512, 26, 12, INK);
  hline(28, 128, 968, INK, 4);
  hline(28, 136, 968, INK, 2);
  fillRect(28, 146, 968, 46, RED);
  drawTextC('FRIDAY, 20 NOVEMBER 2026', 512, 156, 4, WHITE);
  // hero scene
  fillRect(28, 204, 968, 250, SKY);
  rect(28, 204, 968, 250, INK, 3);
  drawGlobe(210, 330, 92);
  drawText('SHENZHEN', 120, 436, 2, INK);
  drawFlagPole(520, 226, 110, 66, 'us');
  drawFlagPole(660, 226, 110, 66, 'cn');
  drawFlagPole(800, 226, 110, 66, 'ru');
  drawFigure(575, 330, 22, [232, 190, 150], NAVY, RED);
  drawFigure(715, 330, 22, [240, 205, 165], [40, 40, 40], GOLD);
  drawFigure(855, 330, 22, [225, 185, 150], [70, 60, 90], [200, 200, 200]);
  fillRect(500, 396, 460, 58, [122, 82, 46]);
  fillRect(500, 396, 460, 8, [90, 60, 30]);
  drawText('PEACE SUMMIT', 560, 416, 3, WHITE);
  // headline
  drawTextC('TRUMP, XI AND PUTIN', 512, 478, 7, INK);
  drawTextC('SIGN PEACE PACT', 512, 536, 7, RED);
  drawTextC('IN SHENZHEN', 512, 594, 7, INK);
  hline(28, 656, 968, INK, 3);
  // three columns
  const cols = [
    { x: 28, k: 'JUSTICE', h: 'ICJ: MYANMAR GUILTY OF GENOCIDE', b: 'World court rules the 2017 campaign against the Rohingya was genocide.' },
    { x: 360, k: 'TECH', h: 'ANTHROPIC IPO SMASHES RECORDS', b: '$81.3bn listing. Shares close up 17% near $97 on Nasdaq.' },
    { x: 692, k: 'WAR', h: 'HOUTHI MISSILE HITS RIYADH TOWER', b: 'Tallest tower in KAFD struck. Iran widens attacks on Gulf tankers.' },
  ];
  for (const col of cols) {
    drawText(col.k, col.x, 676, 3, RED);
    drawPara(col.h, col.x, 706, 3, 304, INK, 30);
    const subY = 706 + wrap(col.h, 3, 304).length * 30 + 8;
    drawPara(col.b, col.x, subY, 2, 304, GREY, 20);
  }
  hline(28, 916, 968, INK, 3);
  // ticker
  fillRect(28, 928, 968, 72, NAVY);
  drawTextC('MARKETS FALL: S&P -2.0%  NIKKEI -4.7%', 512, 940, 3, WHITE);
  drawTextC('COP31 CLOSES IN ANTALYA  |  APEC ADOPTS SHENZHEN OUTLOOK', 512, 972, 2, GOLD);
}

// ---------------------------------------------------------------- variant B
function drawB(): void {
  fillRect(0, 0, W, H, PAPER);
  fillRect(0, 0, W, 64, RED);
  drawTextC('FRIDAY, 20 NOVEMBER 2026', 512, 14, 4, WHITE);
  // poster headline block
  fillRect(0, 64, W, 168, NAVY);
  drawTextC('TRUMP, XI AND PUTIN', 512, 84, 8, WHITE);
  drawTextC('SIGN PEACE PACT', 512, 156, 8, GOLD);
  // hero scene
  fillRect(0, 232, W, 408, SKY);
  drawGlobe(512, 400, 150);
  drawFlagPole(120, 268, 120, 72, 'us');
  drawFlagPole(300, 268, 120, 72, 'cn');
  drawFlagPole(700, 268, 120, 72, 'ru');
  drawFigure(300, 560, 30, [232, 190, 150], NAVY, RED);
  drawFigure(512, 560, 30, [240, 205, 165], [40, 40, 40], GOLD);
  drawFigure(724, 560, 30, [225, 185, 150], [70, 60, 90], [200, 200, 200]);
  fillRect(180, 600, 664, 40, [122, 82, 46]);
  drawTextC('FIRST THREE-WAY SUMMIT  -  SHENZHEN', 512, 610, 2, WHITE);
  // four strips
  const strips = [
    { bg: NAVY, tag: 'ICJ', h: 'MYANMAR GUILTY OF GENOCIDE', s: 'World court: the 2017 campaign against the Rohingya was genocide.' },
    { bg: TEAL, tag: 'IPO', h: 'ANTHROPIC: $81.3BN IPO, SHARES +17%', s: 'Record listing closes near $97 on Nasdaq.' },
    { bg: RED, tag: 'WAR', h: 'HOUTHI MISSILE HITS RIYADH TOWER', s: 'KAFD tallest tower struck; Iran widens Gulf tanker attacks.' },
    { bg: GREEN, tag: '$$$ ', h: 'MARKETS FALL, COP31 CLOSES', s: 'S&P -2.0%, Nikkei -4.7%. COP31 ends in Antalya; APEC adopts Shenzhen Outlook.' },
  ];
  let y = 656;
  for (const st of strips) {
    fillRect(0, y, W, 82, WHITE);
    rect(0, y, W, 82, INK, 2);
    fillRect(0, y, 96, 82, st.bg);
    drawTextC(st.tag, 48, y + 28, 3, WHITE);
    drawText(st.h, 116, y + 12, 3, INK);
    drawPara(st.s, 116, y + 46, 2, 890, GREY, 20);
    y += 86;
  }
}

// ---------------------------------------------------------------- variant C
function panel(x: number, y: number, w: number, h: number, num: string, color: RGB, title: string, sub: string, icon: (cx: number, cy: number) => void): void {
  fillRect(x, y, w, h, WHITE);
  rect(x, y, w, h, INK, 3);
  fillRect(x, y, w, 44, color);
  drawText(num, x + 14, y + 10, 3, WHITE);
  const headLines = wrap(title, 3, w - 28);
  drawPara(title, x + 14, y + 58, 3, w - 28, INK, 30);
  const iconY = y + 58 + headLines.length * 30 + 78;
  icon(x + Math.floor(w / 2), iconY);
  const subY = y + 58 + headLines.length * 30 + 168;
  drawPara(sub, x + 14, subY, 2, w - 28, GREY, 20);
}
function drawC(): void {
  fillRect(0, 0, W, H, PAPER);
  fillRect(28, 24, 968, 116, NAVY);
  drawTextC('FRIDAY, 20 NOVEMBER 2026', 512, 38, 5, WHITE);
  drawTextC('FIVE STORIES THAT DEFINED THE DAY', 512, 96, 3, GOLD);
  panel(28, 156, 306, 400, '1', RED, 'TRUMP, XI AND PUTIN SIGN PEACE PACT',
    'First three-way summit in Shenzhen. Four-point peace declaration: no nuclear war, UN reform.',
    (cx, cy) => { drawGlobe(cx, cy, 62); drawFlagCN(cx - 78, cy - 84, 52, 32); drawFlagUS(cx + 26, cy - 84, 52, 32); });
  panel(359, 156, 306, 400, '2', NAVY, 'ICJ: MYANMAR COMMITTED GENOCIDE',
    'World court rules the 2017 campaign against the Rohingya was genocide.',
    (cx, cy) => drawScales(cx, cy, 52, INK));
  panel(690, 156, 306, 400, '3', TEAL, 'ANTHROPIC IPO: $81.3BN, +17%',
    'Record listing. Shares close near $97 on Nasdaq.',
    (cx, cy) => drawChart(cx, cy, 150, 100, true, GREEN));
  panel(28, 572, 476, 400, '4', [120, 40, 20], 'HOUTHI MISSILE HITS RIYADH TOWER',
    'Tallest tower in KAFD struck. Iran widens attacks on ships and tankers in the Gulf.',
    (cx, cy) => { drawTower(cx - 20, cy + 70, 120, INK); drawMissile(cx + 90, cy - 70, cx - 6, cy - 30); });
  panel(520, 572, 476, 400, '5', GREEN, 'MARKETS FALL AS COP31 CLOSES',
    'S&P 500 -2.0%, Nikkei -4.7%. COP31 ends in Antalya. APEC adopts the Shenzhen Outlook on trade and AI.',
    (cx, cy) => drawChart(cx, cy, 170, 100, false, RED));
}

// ---------------------------------------------------------------- PNG encode
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- main
const variant = (process.env.VARIANT ?? 'a').toLowerCase();
if (variant === 'b') drawB();
else if (variant === 'c') drawC();
else drawA();
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? 'out';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), encodePNG());
