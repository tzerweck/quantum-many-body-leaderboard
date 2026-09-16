// The QMBL mark: a 3x3 square lattice with four singlet bonds drawn as needles pivoting on a
// site, and one unpaired corner site. On the site the needles fade in at random angles, spring
// onto their partner sites, then the two left plaquettes flip in turn (A -> B -> A -> C -> A)
// before the whole thing dissolves and starts again. The favicon is covering A, frozen.
//
//   A            B            C
//   o-o  o       o o  o       o-o  o
//        |       | |  |            |
//   o-o  o       o o  o       o o  o
//                             | |
//   o-o  .       o-o  .       o o  .
//
// Also generates figures/logo-neel.svg (+ -dark): the README animation, a 4x4 grid of text
// arrows scrambling and settling into a Neel checkerboard - the same idea in ASCII.
//
//   node scripts/logo.mjs        writes the figures; site.mjs imports the functions.
//
// The PNG icons in scripts/assets/ (Safari, home screens) are rasterised from the favicon
// with ImageMagick and committed, since the Pages build has no rasteriser:
//   convert -background none -density 384 _site/favicon.svg -resize 32x32 scripts/assets/favicon-32.png
//   convert -background none -density 384 _site/favicon.svg -resize 140x140 -gravity center \
//     -background '#fcfcfb' -extent 180x180 -alpha off scripts/assets/apple-touch-icon.png
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const f = n => Number(n.toFixed(2));
const P = [6, 16, 26];              // site coordinates in a 32x32 box
const SEED = [131, -97, 62, -148, 41, 155, -73, 118, -29, 87, -139, 19, 104, -58, 146, -112];

// pivot site, lattice angles in coverings A/B/C, and the inward angle range the intro may
// start from (so a needle never pokes out of the box during the swing)
const NEEDLES = [
  { px: P[0], py: P[0], r: [  0,  90,   0], range: [ -20, 110] },
  { px: P[1], py: P[1], r: [180, 270,  90], range: [  70, 290] },
  { px: P[0], py: P[2], r: [  0,   0, -90], range: [-110,  20] },
  { px: P[2], py: P[0], r: [ 90,  90,  90], range: [  70, 200] },
];
const HOLE = { cx: P[2], cy: P[2] };

function startAngle([ra], [lo, hi], i) {
  let r0 = lo + (SEED[i] + 160) / 320 * (hi - lo);
  if (Math.abs(r0 - ra) < 35) r0 = Math.abs(hi - ra) > Math.abs(lo - ra) ? hi - 5 : lo + 5;
  return f(r0);
}

function sites(staticFavicon) {
  const out = [];
  for (const y of P) for (const x of P) {
    out.push(`<circle class="dt" cx="${x}" cy="${y}" r="2.4"/>`);
    if (x === HOLE.cx && y === HOLE.cy) out.push(`<circle class="hl" cx="${x}" cy="${y}" r="${staticFavicon ? 1.4 : 1.3}"/>`);
  }
  return out.join("\n");
}

// ------------------------------------------------------------------ animated header mark
export function logoSvg() {
  const frame = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    if (c < 2) frame.push(`<line class="fr" x1="${P[c]}" y1="${P[r]}" x2="${P[c+1]}" y2="${P[r]}" style="--d3:${f(((r*3+c)*0.9)%4)}s"/>`);
    if (r < 2) frame.push(`<line class="fr" x1="${P[c]}" y1="${P[r]}" x2="${P[c]}" y2="${P[r+1]}" style="--d3:${f(((r*3+c)*1.3)%4)}s"/>`);
  }
  const needles = NEEDLES.map((n, i) => {
    const [ra, rb, rc] = n.r;
    const d = f(-((i * 0.13) % 0.5)), d2 = f((i * 0.71) % 3.4);
    return `<g transform="translate(${n.px} ${n.py})"><g class="nd" style="--r0:${startAngle(n.r, n.range, i)}deg;--ra:${ra}deg;--rb:${rb}deg;--rc:${rc}deg;--d:${d}s">` +
      `<line x1="0" y1="0" x2="10" y2="0" style="--d2:${d2}s"/></g></g>`;
  });
  return `<svg class="logo" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
${frame.join("\n")}
${needles.join("\n")}
${sites(false)}
</svg>`;
}

// Uses the site's palette variables (--ink, --bg, --accent, --grid).
export const LOGO_CSS = `
.logo { display: inline-block; vertical-align: middle; overflow: visible; }
.logo .dt { fill: var(--ink); animation: logo-dt 12s infinite; }
.logo .hl { fill: var(--bg); }
.logo .fr { stroke: var(--grid); stroke-width: 1; stroke-linecap: round;
  animation: logo-fr 4s ease-in-out infinite; animation-delay: var(--d3); }
.logo .nd { transform: rotate(var(--ra)); animation: logo-nd 12s infinite; animation-delay: var(--d); }
.logo .nd line { stroke: var(--accent); stroke-width: 3.2; stroke-linecap: round;
  animation: logo-breathe 3.4s ease-in-out infinite; animation-delay: var(--d2); }
@keyframes logo-nd {
  0%       { opacity: 0; transform: rotate(var(--r0)); animation-timing-function: ease-out; }
  6%       { opacity: 1; transform: rotate(var(--r0)); animation-timing-function: cubic-bezier(.34,1.56,.64,1); }
  22%, 34% { opacity: 1; transform: rotate(var(--ra)); animation-timing-function: cubic-bezier(.34,1.56,.64,1); }
  42%, 52% { transform: rotate(var(--rb)); animation-timing-function: cubic-bezier(.34,1.56,.64,1); }
  60%, 68% { transform: rotate(var(--ra)); animation-timing-function: cubic-bezier(.34,1.56,.64,1); }
  76%, 86% { transform: rotate(var(--rc)); animation-timing-function: cubic-bezier(.34,1.56,.64,1); }
  92%, 96% { opacity: 1; transform: rotate(var(--ra)); animation-timing-function: ease-in; }
  98%      { opacity: 0; transform: rotate(var(--ra)); }
  100%     { opacity: 0; transform: rotate(var(--r0)); }
}
@keyframes logo-dt { 0% { opacity: .35 } 6%, 96% { opacity: 1 } 98%, 100% { opacity: .35 } }
@keyframes logo-breathe { 0%, 100% { stroke-width: 3.2 } 50% { stroke-width: 2.5 } }
@keyframes logo-fr { 0%, 100% { opacity: .45 } 50% { opacity: 1 } }
@media (prefers-reduced-motion: reduce) { .logo, .logo * { animation: none !important; } }
`;

// ------------------------------------------------------------------ favicon: covering A, frozen
export function faviconSvg() {
  const bonds = NEEDLES.map(n =>
    `<line class="bd" x1="${n.px}" y1="${n.py}" x2="${f(n.px + 10 * Math.cos(n.r[0] * Math.PI / 180))}" y2="${f(n.py + 10 * Math.sin(n.r[0] * Math.PI / 180))}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<style>
.dt { fill: #0b0b0b } .hl { fill: #fcfcfb } .bd { stroke: #2a78d6; stroke-width: 3.2; stroke-linecap: round }
@media (prefers-color-scheme: dark) { .dt { fill: #ffffff } .hl { fill: #1a1a19 } .bd { stroke: #3987e5 } }
</style>
${bonds.join("\n")}
${sites(true)}
</svg>
`;
}

// ------------------------------------------------------------------ README: arrows settling into Neel order
// Text-only, so it works wherever an SVG renders as an image (GitHub proxies README images
// through camo, which keeps CSS animations but not scripts). Every arrow is positioned on
// its own cell centre, so the grid does not depend on the viewer's monospace font.
export function asciiNeelSvg({ dark = false } = {}) {
  const ink = dark ? "#ffffff" : "#0b0b0b", accent = dark ? "#3987e5" : "#2a78d6", muted = "#898781";
  const N = 4, ARROWS = ["↑", "→", "↓", "←"];
  let s = 7;                                                 // tiny deterministic PRNG
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const order = [...Array(N * N).keys()].sort(() => rnd() - 0.5);       // who settles when
  const settleAt = order.map((k, i) => 5 + Math.floor(i * 1.5));       // by site index k
  const dissolveAt = order.map(() => 0);
  order.forEach((k, i) => { dissolveAt[k] = 2 + Math.floor(i * 0.5); });
  const target = k => ((k % N) + Math.floor(k / N)) % 2 === 0 ? 0 : 2;  // up on one sublattice
  const settledFrame = Math.max(...settleAt) + 1;

  // frame list: [duration in s, cell states]; state = {ch, col}
  const frames = [];
  const push = (dur, cells) => frames.push([dur, cells]);
  const dot = { ch: "·", col: muted };
  push(0.5, Array(N * N).fill({ ch: " ", col: muted }));
  push(0.3, Array(N * N).fill(dot));
  let prev = Array(N * N).fill(-1);
  for (let t = 0; t < settledFrame; t++) {
    const cells = [];
    for (let k = 0; k < N * N; k++) {
      if (t >= settleAt[k]) cells.push({ ch: ARROWS[target(k)], col: target(k) === 0 ? accent : ink });
      else if (t < 2) cells.push(dot);
      else {
        let a; do { a = Math.floor(rnd() * 4); } while (a === prev[k]);
        prev[k] = a;
        cells.push({ ch: ARROWS[a], col: muted });
      }
    }
    push(0.11, cells);
  }
  frames[frames.length - 1][0] = 2.2;                                   // hold the ordered state
  const dissolveEnd = Math.max(...dissolveAt) + 1;
  for (let t = 0; t < dissolveEnd; t++) {
    push(0.09, [...Array(N * N).keys()].map(k => t >= dissolveAt[k] ? dot
      : { ch: ARROWS[target(k)], col: target(k) === 0 ? accent : ink }));
  }
  push(0.4, Array(N * N).fill(dot));

  const T = frames.reduce((a, [d]) => a + d, 0);
  const cell = 22, pad = 12, size = pad * 2 + N * cell;
  let t0 = 0, css = "", body = "";
  frames.forEach(([dur, cells], i) => {
    const a = f(t0 / T * 100), b = f((t0 + dur) / T * 100);
    t0 += dur;
    css += `.f${i}{animation:f${i} ${f(T)}s step-end infinite}@keyframes f${i}{0%,${a}%{opacity:0}${a === 0 ? "0.001" : a}%,${b}%{opacity:1}${b}%,100%{opacity:0}}\n`;
    const spans = cells.map((c, k) => c.ch === " " ? "" :
      `<text x="${pad + (k % N) * cell + cell / 2}" y="${pad + Math.floor(k / N) * cell + cell * 0.74}" fill="${c.col}">${c.ch}</text>`).join("");
    body += `<g class="f${i}" opacity="0">${spans}</g>\n`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * 2}" height="${size * 2}" role="img" aria-label="Spins settling into Néel order">
<style>
text { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace; font-size: 20px; text-anchor: middle; }
${css}@media (prefers-reduced-motion: reduce) { g { animation: none !important; } .f${settledFrame + 1} { opacity: 1 !important; } }
</style>
${body}</svg>
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  fs.writeFileSync(path.join(root, "figures/logo-neel.svg"), asciiNeelSvg());
  fs.writeFileSync(path.join(root, "figures/logo-neel-dark.svg"), asciiNeelSvg({ dark: true }));
  fs.writeFileSync(path.join(root, "figures/logo.svg"), faviconSvg());
  console.log("wrote figures/logo-neel.svg, figures/logo-neel-dark.svg, figures/logo.svg");
}
