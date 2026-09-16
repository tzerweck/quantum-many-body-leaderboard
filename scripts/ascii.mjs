// The README's text-mode animations, rendered frame by frame with ImageMagick and encoded to GIF:
//
//   figures/qmbl-ascii.gif     "QMBL" in the ANSI Shadow figlet font next to a 6x12 spin lattice:
//                              a Metropolis run on an antiferromagnet with the temperature swept
//                              down and up, so the Neel checkerboard orders, holds and melts; the
//                              arrows jitter with T. The "order" bar is the staggered magnetisation
//                              of the frame, nothing from the leaderboard.
//   figures/lattice-strip.gif  the footer: a cosine potential (an optical lattice) sliding by while
//                              its depth breathes - one atom per well when deep, delocalised dots
//                              when shallow.
//
// Not part of build.sh: needs ImageMagick (convert), ffmpeg and DejaVu Sans Mono, and the GIFs are
// committed. Regenerate with:  node scripts/ascii.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const S = 2;
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf";
// DejaVu Sans Mono block glyphs: 1.233 em tall, top at 0.967 em above the baseline (measured)
const FS = 15 * S, LH = Math.round(FS * 1.233) - 1, ASC = Math.round(FS * 0.967), CW = Math.round(FS * 0.602 * 100) / 100;
const C = { bg: "#1a1a19", ink: "#ffffff", ink2: "#c3c2b7", muted: "#898781", shadow: "#5a5955", grid: "#3a3936", accent: "#3987e5", accent2: "#2a5a9e", accent3: "#1c3a66" };

const QMBL = [
  " ██████╗ ███╗   ███╗██████╗ ██╗     ",
  "██╔═══██╗████╗ ████║██╔══██╗██║     ",
  "██║   ██║██╔████╔██║██████╔╝██║     ",
  "██║▄▄ ██║██║╚██╔╝██║██╔══██╗██║     ",
  "╚██████╔╝██║ ╚═╝ ██║██████╔╝███████╗",
  " ╚══▀▀═╝ ╚═╝     ╚═╝╚═════╝ ╚══════╝",
];
const SUB = "the quantum many-body leaderboard";

let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

// a frame is rows of cells [char, colour]; render batches runs of one colour into one -annotate
function render(rows, cols, frames, name, { padC = 2, padR = 1 } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "qmbl-ascii-"));
  const W = Math.round((cols + 2 * padC) * CW), H = (rows + 2 * padR) * LH;
  let concat = "";
  frames.forEach((fr, i) => {
    const args = ["-size", `${W}x${H}`, `xc:${C.bg}`, "-font", FONT, "-pointsize", String(FS)];
    fr.cells.forEach((row, r) => {
      let c = 0;
      while (c < row.length) {
        if (!row[c] || row[c][0] === " ") { c++; continue; }
        const colour = row[c][1], dx = row[c][2] || 0, dy = row[c][3] || 0; let text = ""; const c0 = c;
        if (dx || dy) { text = row[c][0]; c++; }                       // jittered cells are drawn alone
        else while (c < row.length && row[c] && row[c][1] === colour && row[c][0] !== " " && !row[c][2] && !row[c][3]) { text += row[c][0]; c++; }
        args.push("-fill", colour, "-annotate", `+${Math.round((padC + c0) * CW + dx)}+${padR * LH + r * LH + ASC + dy}`, text);
      }
    });
    const file = `${dir}/f${String(i).padStart(3, "0")}.png`;
    args.push(file); execFileSync("convert", args);
    concat += `file '${file}'\nduration ${fr.dur}\n`;
  });
  concat += `file '${dir}/f${String(frames.length - 1).padStart(3, "0")}.png'\n`;
  writeFileSync(`${dir}/frames.txt`, concat);
  const out = path.join(ROOT, "figures", `${name}.gif`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", `${dir}/frames.txt`, "-vf",
    "split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle", "-loop", "0", out]);
  rmSync(dir, { recursive: true, force: true });
  console.log(path.relative(ROOT, out), frames.length, "frames", frames.reduce((a, f) => a + f.dur, 0).toFixed(1), "s", `${W}x${H}`);
}
const blank = (rows, cols) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => [" ", C.ink]));
const put = (cells, r, c, text, colour) => { [...text].forEach((ch, i) => { if (cells[r] && cells[r][c + i]) cells[r][c + i] = [ch, colour]; }); };
// ANSI Shadow: the blocks in ink, the box-drawing "shadow" in grey
const putLetters = (cells, r0, c0) => QMBL.forEach((line, i) => [...line].forEach((ch, j) => {
  if (ch !== " ") cells[r0 + i][c0 + j] = [ch, "█▄▀".includes(ch) ? C.ink : C.shadow];
}));

// ------------------------------------------------------------------ spins: T sweeps down and up
function spins() {
  const R = 6, K = 12;                         // lattice rows x cols
  const cols = 36 + 4 + K * 2, rows = 6 + 3;
  let s = Array.from({ length: R }, () => Array.from({ length: K }, () => (rnd() < 0.5 ? 1 : -1)));
  const neel = (r, c) => ((r + c) % 2 ? -1 : 1);
  const E = (r, c) => { let e = 0; for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) { const rr = r + dr, cc = c + dc; if (s[rr] && s[rr][cc] !== undefined) e += s[r][c] * s[rr][cc]; } return e; };  // antiferro: J>0
  const frames = [];
  const N = 110;
  const jit = Array.from({ length: R * K }, () => ({ p: rnd() * 6.3, q: rnd() * 6.3, w: 0.35 + rnd() * 0.5, v: 0.3 + rnd() * 0.4 }));
  for (let t = 0; t < N; t++) {
    const x = t / N;
    const T = x < 0.55 ? 3.2 * Math.pow(1 - x / 0.55, 1.6) + 0.08 : 0.08 + 3.2 * Math.pow((x - 0.55) / 0.45, 2.2);
    for (let k = 0; k < 30; k++) {
      const r = Math.floor(rnd() * R), c = Math.floor(rnd() * K);
      const dE = -2 * E(r, c);                   // flipping s -> -s changes J*s*sum by -2*s*sum ... sign for antiferro
      if (dE <= 0 || rnd() < Math.exp(-dE / T)) s[r][c] = -s[r][c];
    }
    const cells = blank(rows, cols);
    putLetters(cells, 1, 0);
    put(cells, 8, 1, SUB, C.muted);
    for (let r = 0; r < R; r++) for (let c = 0; c < K; c++) {
      const up = s[r][c] > 0, ordered = s[r][c] === neel(r, c) || s[r][c] === -neel(r, c) && false;
      const j = jit[r * K + c], amp = (0.6 + 2.6 * Math.min(1, T / 2.5)) * S / 2;   // px: ~0.6 cold, ~3 hot
      cells[1 + r][40 + c * 2] = [up ? "↑" : "↓", up ? C.accent : C.ink2, Math.round(amp * Math.sin(j.p + t * j.w)), Math.round(0.5 * amp * Math.sin(j.q + t * j.v))];
    }
    const stag = Math.abs(s.flatMap((row, r) => row.map((v, c) => v * neel(r, c))).reduce((a, b) => a + b, 0)) / (R * K);
    put(cells, 8, 40, `T ${x < 0.55 ? "↓" : "↑"}   order ${"█".repeat(Math.round(stag * 12)).padEnd(12, "░")}`, C.muted);
    frames.push({ cells, dur: 0.09 });
  }
  render(rows, cols, frames, "qmbl-ascii");
}

// ------------------------------------------------------------------ wave: optical lattice, depth breathes
function wave() {
  const cols = 96, WR = 4, rows = WR;
  const LV = "▁▂▃▄▅▆▇█";
  const frames = [], N = 96, period = 16;
  for (let t = 0; t < N; t++) {
    const x = t / N;
    const depth = 0.3 + 0.7 * (0.5 - 0.5 * Math.cos(2 * Math.PI * x));      // shallow -> deep -> shallow
    const phase = 2 * Math.PI * x;
    const cells = blank(rows, cols);
    // filled potential landscape: dark body, bright top edge
    const Hc = c => depth * (0.5 + 0.5 * Math.cos(2 * Math.PI * c / period + phase)) * WR * 8 + 3;   // eighths
    for (let c = 0; c < cols; c++) {
      const h = Hc(c);
      for (let r = 0; r < WR; r++) {
        const lv = Math.max(0, Math.min(8, Math.round(h - r * 8)));
        if (lv > 0) put(cells, WR - 1 - r, c, LV[lv - 1], lv < 8 || h - (r + 1) * 8 < 8 ? C.accent : C.accent3);
      }
    }
    // atoms: one per well at the floor when deep; spread-out dots when shallow
    for (let c = 0; c < cols; c++) {
      const u = (((2 * Math.PI * c / period + phase) / (2 * Math.PI)) % 1 + 1) % 1;
      const d = Math.abs(u - 0.5) * period;
      const rowAtom = WR - 1 - Math.floor(Hc(c) / 8);
      if (depth > 0.6 && d < 0.5) put(cells, rowAtom, c, "●", C.ink);
      else if (depth <= 0.6 && d < 4.5 && (c * 7 + t) % 4 === 0) put(cells, rowAtom, c, "∘", C.ink2);
    }
    frames.push({ cells, dur: 0.08 });
  }
  render(rows, cols, frames, "lattice-strip", { padC: 0, padR: 0 });
}

spins();
wave();
