// The README's text-mode animations, rendered frame by frame with ImageMagick and encoded to GIF:
//
//   figures/qmbl-ascii.gif       "QMBL" in the Alpha figlet font whose ':' fill is a spin lattice,
//                                the tagline under it, and a 9x10 lattice of arrows to the right,
//                                both antiferromagnets under one Metropolis temperature sweep: the
//                                fill and the arrows crystallise into Neel order, hold and melt;
//                                the arrows jitter with T; the bar is the arrows' bond order (the
//                                share of antiparallel neighbour pairs, 0 at random, 1 when
//                                ordered - a domain wall still counts as ordered, as the eye sees
//                                it). Blue is spin up, grey spin down. Nothing from the
//                                leaderboard is plotted.
//   figures/lattice-strip.gif    the footer: a cosine potential (an optical lattice) sliding by
//                                while its depth breathes - one atom per well when deep,
//                                delocalised dots when shallow.
//   figures/qmbl-ticks-slant.txt "QMBL" in the Ticks Slant figlet font, plain text, for wherever a
//                                <pre> is wanted (site footer).
//
// Not part of build.sh: needs ImageMagick (convert), ffmpeg and DejaVu Sans Mono, and the GIFs are
// committed. Regenerate with:  node scripts/ascii.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadFont, render as figlet } from "./figlet.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const S = 2;                                   // render scale (the GIFs are 2x for retina screens)
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf";
// DejaVu Sans Mono block glyphs: 1.233 em tall, top at 0.967 em above the baseline (measured)
const FS = 11 * S, LH = Math.round(FS * 1.233) - 1, ASC = Math.round(FS * 0.967), CW = Math.round(FS * 0.602 * 100) / 100;
const C = { bg: "#1a1a19", ink: "#ffffff", ink2: "#c3c2b7", muted: "#898781", accent: "#3987e5", accent3: "#1c3a66" };
// ImageMagick -annotate: backslash and percent are escapes, a leading @ reads a file, leading spaces vanish
const esc = t => t.replace(/\\/g, "\\\\").replace(/%/g, "%%");
const annotate = (args, x, y, text, colour) => {
  const at = text.startsWith("@");
  args.push("-fill", colour, "-annotate", `+${Math.round(at ? x - CW : x)}+${y}`, (at ? " " : "") + esc(text));
};
let seed = 4242;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

function banner(fontName, text) {
  const font = loadFont(path.join(ROOT, "scripts/fonts", `${fontName}.flf`));
  let lines = figlet(font, text);
  const lead = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
  lines = lines.map(l => l.slice(lead).replace(/\s+$/, ""));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  return lines;
}

function encode(dir, frames, name, width = null) {
  let concat = "";
  frames.forEach((dur, i) => { concat += `file 'f${String(i).padStart(3, "0")}.png'\nduration ${dur}\n`; });
  concat += `file 'f${String(frames.length - 1).padStart(3, "0")}.png'\n`;
  writeFileSync(`${dir}/frames.txt`, concat);
  const out = path.join(ROOT, "figures", `${name}.gif`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", `${dir}/frames.txt`, "-vf",
    (width ? `scale=${width}:-1:flags=lanczos,` : "") + "split[a][b];[a]palettegen=max_colors=32:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle", "-loop", "0", out]);
  rmSync(dir, { recursive: true, force: true });
  console.log(path.relative(ROOT, out), frames.length, "frames", frames.reduce((a, d) => a + d, 0).toFixed(1), "s");
}

// ------------------------------------------------------------------ header: Alpha with a live fill
function header() {
  const lines = banner("Alpha", "QMBL"), fill = ":";
  const R = lines.length, K = Math.max(...lines.map(l => l.length));
  // fill sites inside the letters
  const sites = [], idx = new Map();
  for (let r = 0; r < R; r++) for (let c = 0; c < K; c++) if (lines[r][c] === fill) { idx.set(r * K + c, sites.length); sites.push([r, c]); }
  const nbr = sites.map(([r, c]) => [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]].map(([x, y]) => idx.get(x * K + y)).filter(v => v !== undefined));
  const s = sites.map(() => (rnd() < 0.5 ? 1 : -1));
  // the arrow lattice, drawn at twice the font size so the arrows stay legible at README width
  const LR = 9, LK = 10, F2 = 2;
  const a = Array.from({ length: LR }, () => Array.from({ length: LK }, () => (rnd() < 0.5 ? 1 : -1)));
  const jit = Array.from({ length: LR * LK }, () => ({ p: rnd() * 6.3, q: rnd() * 6.3, w: 0.35 + rnd() * 0.5, v: 0.3 + rnd() * 0.4 }));
  const padC = 1, padR = 1, gap = 5;
  const latC = padC + K + gap, latR = padR + Math.floor((R - LR * F2) / 2);   // lattice origin, letter-grid units
  const cols = latC + LK * 2 * F2 + padC, rows = padR + R + 3;
  const W = Math.round(cols * CW), H = rows * LH;
  const dir = mkdtempSync(path.join(tmpdir(), "qmbl-ascii-"));
  const N = 110, frames = [];
  for (let t = 0; t < N; t++) {
    const x = t / N;                                                       // T: fast quench, slow reheat
    const T = x < 0.55 ? 3.2 * Math.pow(1 - x / 0.55, 1.6) + 0.08 : 0.08 + 3.2 * Math.pow((x - 0.55) / 0.45, 2.2);
    for (let k = 0; k < sites.length * 0.6; k++) {                         // J > 0 on both systems
      const i = Math.floor(rnd() * sites.length);
      const dE = -2 * s[i] * nbr[i].reduce((acc, j) => acc + s[j], 0);
      if (dE <= 0 || rnd() < Math.exp(-dE / T)) s[i] = -s[i];
    }
    for (let k = 0; k < 60; k++) {
      const r = Math.floor(rnd() * LR), c = Math.floor(rnd() * LK);
      let e = 0; for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (a[r + dr] && a[r + dr][c + dc] !== undefined) e += a[r + dr][c + dc];
      const dE = -2 * a[r][c] * e;
      if (dE <= 0 || rnd() < Math.exp(-dE / T)) a[r][c] = -a[r][c];
    }
    const args = ["-size", `${W}x${H}`, `xc:${C.bg}`, "-font", FONT, "-pointsize", String(FS)];
    for (let r = 0; r < R; r++)
      for (const m of lines[r].matchAll(/[^\s:]+/g)) annotate(args, (padC + m.index) * CW, (padR + r) * LH + ASC, m[0], C.ink);
    sites.forEach(([r, c], i) => annotate(args, (padC + c) * CW, (padR + r) * LH + ASC, s[i] > 0 ? ":" : "·", s[i] > 0 ? C.accent : C.ink2));
    annotate(args, (padC + 2) * CW, (padR + R + 1) * LH + ASC, "the quantum many-body leaderboard", C.muted);
    let sat = 0, bonds = 0;
    for (let r = 0; r < LR; r++) for (let c = 0; c < LK; c++) {
      if (c + 1 < LK) { bonds++; if (a[r][c] !== a[r][c + 1]) sat++; }
      if (r + 1 < LR) { bonds++; if (a[r][c] !== a[r + 1][c]) sat++; }
    }
    const order = Math.max(0, 2 * (sat / bonds - 0.5));
    annotate(args, latC * CW, (padR + R + 1) * LH + ASC, `T ${x < 0.55 ? "↓" : "↑"}   order ${"█".repeat(Math.round(order * 12)).padEnd(12, "░")}`, C.muted);
    args.push("-pointsize", String(FS * F2));
    const amp = (0.6 + 2.6 * Math.min(1, T / 2.5)) * S;                    // px: ~1 cold, ~6 hot (at 2x)
    for (let r = 0; r < LR; r++) for (let c = 0; c < LK; c++) {
      const j = jit[r * LK + c], up = a[r][c] > 0;
      annotate(args, (latC + c * 2 * F2) * CW + amp * Math.sin(j.p + t * j.w), (latR + r * F2) * LH + ASC * F2 + 0.5 * amp * Math.sin(j.q + t * j.v), up ? "↑" : "↓", up ? C.accent : C.ink2);
    }
    args.push(`${dir}/f${String(t).padStart(3, "0")}.png`); execFileSync("convert", args);
    frames.push(0.09);
  }
  encode(dir, frames, "qmbl-ascii");                                      // native 1840 px: resampling only inflates the GIF
}

// ------------------------------------------------------------------ footer: optical lattice strip
function strip() {
  const cols = 96, WR = 4, LV = "▁▂▃▄▅▆▇█", N = 96, period = 16;
  const dir = mkdtempSync(path.join(tmpdir(), "qmbl-ascii-"));
  const W = Math.round(cols * CW), H = WR * LH;
  const frames = [];
  for (let t = 0; t < N; t++) {
    const x = t / N;
    const depth = 0.3 + 0.7 * (0.5 - 0.5 * Math.cos(2 * Math.PI * x));      // shallow -> deep -> shallow
    const phase = 2 * Math.PI * x;
    const Hc = c => depth * (0.5 + 0.5 * Math.cos(2 * Math.PI * c / period + phase)) * WR * 8 + 3;   // eighths
    const args = ["-size", `${W}x${H}`, `xc:${C.bg}`, "-font", FONT, "-pointsize", String(FS)];
    for (let c = 0; c < cols; c++) {
      const h = Hc(c);
      for (let r = 0; r < WR; r++) {                                          // dark body, bright top edge
        const lv = Math.max(0, Math.min(8, Math.round(h - r * 8)));
        if (lv > 0) annotate(args, c * CW, (WR - 1 - r) * LH + ASC, LV[lv - 1], lv < 8 || h - (r + 1) * 8 < 8 ? C.accent : C.accent3);
      }
      const u = (((2 * Math.PI * c / period + phase) / (2 * Math.PI)) % 1 + 1) % 1, d = Math.abs(u - 0.5) * period;
      const rowAtom = WR - 1 - Math.floor(h / 8);                            // one atom per well when deep, spread when shallow
      if (depth > 0.6 && d < 0.5) annotate(args, c * CW, rowAtom * LH + ASC, "●", C.ink);
      else if (depth <= 0.6 && d < 4.5 && (c * 7 + t) % 4 === 0) annotate(args, c * CW, rowAtom * LH + ASC, "∘", C.ink2);
    }
    args.push(`${dir}/f${String(t).padStart(3, "0")}.png`); execFileSync("convert", args);
    frames.push(0.08);
  }
  encode(dir, frames, "lattice-strip");
}

// ------------------------------------------------------------------ Ticks Slant, plain text
function ticks() {
  const out = path.join(ROOT, "figures/qmbl-ticks-slant.txt");
  writeFileSync(out, banner("Ticks Slant", "QMBL").join("\n") + "\n");
  console.log(path.relative(ROOT, out));
}

header();
strip();
ticks();
