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
// Also generates figures/banner.svg (+ -dark): the README header, the same animated mark next
// to the wordmark, self-contained (an SVG shown as an image sees neither the page's CSS nor
// its colour scheme, hence one file per scheme).
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

// the unpaired site is a ring, so the mark needs no background colour
function sites() {
  const out = [];
  for (const y of P) for (const x of P)
    out.push(x === HOLE.cx && y === HOLE.cy
      ? `<circle class="dt hl" cx="${x}" cy="${y}" r="1.8"/>`
      : `<circle class="dt" cx="${x}" cy="${y}" r="2.4"/>`);
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
${sites()}
</svg>`;
}

// Uses the site's palette variables (--ink, --accent, --grid).
export const LOGO_CSS = `
.logo { display: inline-block; vertical-align: middle; overflow: visible; }
.logo .dt { fill: var(--ink); animation: logo-dt 12s infinite; }
.logo .hl { fill: none; stroke: var(--ink); stroke-width: 1.2; }
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
.dt { fill: #0b0b0b } .hl { fill: none; stroke: #0b0b0b; stroke-width: 1.2 } .bd { stroke: #2a78d6; stroke-width: 3.2; stroke-linecap: round }
@media (prefers-color-scheme: dark) { .dt { fill: #ffffff } .hl { stroke: #ffffff } .bd { stroke: #3987e5 } }
</style>
${bonds.join("\n")}
${sites()}
</svg>
`;
}

// ------------------------------------------------------------------ README banner: mark + wordmark
const PALETTE = {
  light: { bg: "#fcfcfb", ink: "#0b0b0b", muted: "#898781", grid: "#e1e0d9", accent: "#2a78d6" },
  dark:  { bg: "#1a1a19", ink: "#ffffff", muted: "#898781", grid: "#2c2c2a", accent: "#3987e5" },
};
const SERIF = `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`;
const SANS = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;

export function bannerSvg({ dark = false } = {}) {
  const c = PALETTE[dark ? "dark" : "light"];
  const W = 640, H = 128, M = 96;                       // mark M x M at the left
  const mark = logoSvg().replace('<svg class="logo" viewBox="0 0 32 32"',
    `<svg class="logo" x="16" y="${(H - M) / 2}" width="${M}" height="${M}" viewBox="0 0 32 32" overflow="visible"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="QMBL, the quantum many-body leaderboard">
<style>
svg { --ink: ${c.ink}; --muted: ${c.muted}; --grid: ${c.grid}; --accent: ${c.accent}; }
.name { font-family: ${SERIF}; font-size: 46px; font-weight: 600; letter-spacing: 0.02em; fill: var(--ink); }
.sub  { font-family: ${SANS}; font-size: 15.5px; letter-spacing: 0.1em; text-transform: uppercase; fill: var(--muted); }
${LOGO_CSS}</style>
${mark}
<text class="name" x="136" y="66">QMBL</text>
<text class="sub" x="138" y="92">the quantum many-body leaderboard</text>
</svg>
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  fs.writeFileSync(path.join(root, "figures/banner.svg"), bannerSvg());
  fs.writeFileSync(path.join(root, "figures/banner-dark.svg"), bannerSvg({ dark: true }));
  fs.writeFileSync(path.join(root, "figures/logo.svg"), faviconSvg());
  console.log("wrote figures/banner.svg, figures/banner-dark.svg, figures/logo.svg");
}
