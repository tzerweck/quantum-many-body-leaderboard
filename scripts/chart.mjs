// The drawing kit shared by every figure script (figures.mjs, size_accuracy.mjs,
// pareto.mjs): themes, text metrics, marks, legend, header, footnote and the SVG document.
//
// Every figure is written twice, light and dark. GitHub chooses between the two with a
// <picture> element keyed on the viewer's GitHub theme; an SVG that switched itself on
// prefers-color-scheme would follow the operating system instead, and show a light
// chart on a dark page. Plain SVG strings and no plotting library: the build stays
// offline and dependency-free, and identical data gives byte-identical files, so a
// figure changes in git exactly when its numbers do.
//
// Colours are the validated default palette of the dataviz method (categorical slots in
// fixed order, an ordinal blue ramp, recessive greys). Nothing here is picked by eye.
import fs from "node:fs";
import { rowId } from "./summary.mjs";

export const THEMES = {
  light: {
    surface: "#fcfcfb", ink: "#0b0b0b", ink2: "#52514e", muted: "#898781", grid: "#e1e0d9",
    series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"],
    ordinal: ["#86b6ef", "#2a78d6", "#104281"], // fewest rows -> most
    recessive: ["#c3c2b7", "#898781"],
  },
  dark: {
    surface: "#1a1a19", ink: "#ffffff", ink2: "#c3c2b7", muted: "#898781", grid: "#2c2c2a",
    series: ["#3987e5", "#d95926", "#199e70", "#c98500"],
    ordinal: ["#1c5cab", "#3987e5", "#9ec5f4"], // the ramp flips on a dark surface
    recessive: ["#52514e", "#898781"],
  },
};

// ------------------------------------------------------------------------ drawing kit
export const W = 920, PAD = 28;
export const n = x => +x.toFixed(1);
export const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Layout needs label widths before a browser has seen the text. This over-estimates for
// the usual UI faces, so a label that fits here fits on screen.
export const textWidth = (s, size) => [...s].reduce((w, c) => w + (
  /[il.,:;'|!()\s]/.test(c) ? 0.32 : /[mwMW]/.test(c) ? 0.9 : /[A-Z]/.test(c) ? 0.7 : /\d/.test(c) ? 0.62 : 0.58), 0) * size;

export function wrap(s, size, maxW) {
  const lines = [];
  let line = "";
  for (const word of s.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size) > maxW) { lines.push(line); line = word; } else line = next;
  }
  return line ? [...lines, line] : lines;
}

export const text = (x, y, s, { size = 13, fill, weight, anchor, nums } = {}) =>
  `<text x="${n(x)}" y="${n(y)}" font-size="${size}" fill="${fill}"` +
  (weight ? ` font-weight="${weight}"` : "") + (anchor ? ` text-anchor="${anchor}"` : "") +
  (nums ? ` style="font-variant-numeric:tabular-nums"` : "") + `>${esc(s)}</text>`;

export const hline = (x0, x1, y, stroke, width = 1) =>
  `<path d="M${n(x0)} ${n(y) + 0.5}H${n(x1)}" stroke="${stroke}" stroke-width="${width}"/>`;

// Bars grow from one baseline: square foot, 4px rounded data end.
export function hbar(x0, x1, y, h, fill, rounded = true) {
  const w = x1 - x0;
  if (w <= 0) return "";
  if (!rounded) return `<rect x="${n(x0)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"/>`;
  const r = Math.min(4, w, h / 2);
  return `<path d="M${n(x0)} ${n(y)}H${n(x1 - r)}A${r} ${r} 0 0 1 ${n(x1)} ${n(y + r)}V${n(y + h - r)}` +
    `A${r} ${r} 0 0 1 ${n(x1 - r)} ${n(y + h)}H${n(x0)}Z" fill="${fill}"/>`;
}
export function vbar(x, w, base, top, fill) {
  const h = base - top;
  if (h <= 0) return "";
  const r = Math.min(4, h, w / 2);
  return `<path d="M${n(x)} ${n(base)}V${n(top + r)}A${r} ${r} 0 0 1 ${n(x + r)} ${n(top)}H${n(x + w - r)}` +
    `A${r} ${r} 0 0 1 ${n(x + w)} ${n(top + r)}V${n(base)}Z" fill="${fill}"/>`;
}

// A label set inside a filled mark takes white or ink by the fill's luminance.
export function onFill(hex) {
  const lin = v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map(k => lin(parseInt(hex.slice(k, k + 2), 16) / 255));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0533 ? "#ffffff" : "#0b0b0b";
}

// Surface ring on every dot so overlapping marks stay separable. Hollow = listed only.
export function dot(t, x, y, color, filled, href) {
  const ring = `<circle cx="${n(x)}" cy="${n(y)}" r="6.5" fill="${t.surface}"/>`;
  return linked(href, ring + (filled
    ? `<circle cx="${n(x)}" cy="${n(y)}" r="4.5" fill="${color}"/>`
    : `<circle cx="${n(x)}" cy="${n(y)}" r="4" fill="${t.surface}" stroke="${color}" stroke-width="2"/>`));
}

// The same mark as a downward triangle, for a row whose energy lies below the energy it is
// measured against: on a log scale of the distance it would otherwise pass for a close one.
export function tri(t, x, y, color, filled, href) {
  const path = s => `M${n(x - s)} ${n(y - 0.6 * s)}H${n(x + s)}L${n(x)} ${n(y + s)}Z`;
  return linked(href, `<path d="${path(8.5)}" fill="${t.surface}"/>` + (filled
    ? `<path d="${path(5.5)}" fill="${color}"/>`
    : `<path d="${path(4.6)}" fill="${t.surface}" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`));
}

// A mark that stands for one row links to that row on the table page. Inert where the SVG
// is shown as an image; on the site the figure is inlined, and site.mjs gives the link its
// hover card from the row itself, so the file carries the target and nothing else.
export const rowHref = (inst, r) => `/instances/#${rowId(inst, r)}`;
export const linked = (href, svg) => (href ? `<a class="pt" href="${href}">${svg}</a>` : svg);

export function legend(t, items, y) {
  const out = [];
  let x = PAD, row = y;
  for (const it of items) {
    const w = 22 + textWidth(it.label, 12) + 18;
    if (x + w > W - PAD && x > PAD) { x = PAD; row += 22; }
    const cx = x + 7, cy = row - 4;
    if (it.kind === "line") out.push(`<path d="M${cx - 7} ${cy}H${cx + 7}" stroke="${it.color}" stroke-width="2" stroke-linecap="round"/>`);
    else if (it.kind === "dot" || it.kind === "ring") out.push(dot(t, cx, cy, it.color, it.kind === "dot"));
    else if (it.kind === "tri") out.push(tri(t, cx, cy, it.color, false));
    else out.push(`<rect x="${cx - 5}" y="${cy - 5}" width="10" height="10" rx="2" fill="${it.color}"/>`);
    out.push(text(x + 20, row, it.label, { size: 12, fill: t.ink2 }));
    x += w;
  }
  return { svg: out.join("\n"), bottom: row };
}

// Title and subtitle; returns the y the chart may start below.
export function header(t, title, subtitle) {
  const out = [text(PAD, 38, title, { size: 17, fill: t.ink, weight: 600 })];
  const lines = wrap(subtitle, 13, W - 2 * PAD);
  lines.forEach((l, k) => out.push(text(PAD, 62 + k * 19, l, { size: 13, fill: t.ink2 })));
  return { svg: out.join("\n"), bottom: 62 + (lines.length - 1) * 19 };
}

export function footnote(t, s, y) {
  const lines = wrap(s, 11.5, W - 2 * PAD);
  return { svg: lines.map((l, k) => text(PAD, y + k * 16, l, { size: 11.5, fill: t.muted })).join("\n"), bottom: y + (lines.length - 1) * 16 };
}

export function doc(t, height, title, desc, parts) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${n(height)}" viewBox="0 0 ${W} ${n(height)}" role="img" aria-labelledby="title desc">`,
    `<title id="title">${esc(title)}</title>`,
    `<desc id="desc">${esc(desc)}</desc>`,
    `<style>text{font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}</style>`,
    `<rect width="${W}" height="${n(height)}" rx="8" fill="${t.surface}"/>`,
    ...parts, "</svg>", "",
  ].join("\n");
}

export const pct = (a, b) => `${Math.round((100 * a) / b)}%`;
export const niceStep = raw => { const p = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 5, 10].map(m => m * p).find(m => m >= raw * 0.999); };

// Every figure is written twice, light and dark; the caller reports what was written.
export function writer(out) {
  const written = [];
  const write = (name, render) => {
    fs.mkdirSync(out, { recursive: true });
    for (const [mode, t] of Object.entries(THEMES)) {
      const file = `${out}/${name}${mode === "dark" ? "-dark" : ""}.svg`;
      fs.writeFileSync(file, render(t));
      written.push(file);
    }
  };
  return { write, written };
}

// Log scales, for the accuracy figures: a value below v0 sits at p0 rather than off the
// canvas, and the caller says in its footnote how many did.
export const log = Math.log10;
export const logScale = (v0, v1, p0, p1) => v => p0 + ((log(Math.max(v, v0)) - log(v0)) / (log(v1) - log(v0))) * (p1 - p0);
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export const pow10 = k => "10" + String(k).split("").map(c => SUP[c]).join("");

// A row's method, short enough to label a mark with: "Holographic Quantum Transformer
// (HQT), ..." -> "HQT"; otherwise the text before any parenthesis or comma, which is where
// method strings put the architecture's name. Says when the number is not a bound.
export function shortLabel(r) {
  const acronym = r.method.match(/\(([A-Z][A-Za-z0-9-]{1,7})\)/);
  let s = acronym ? acronym[1] : r.method.split(/\s*[(,]/)[0].trim();
  if (r.bound_type === "projected") s += /fixed.?node|\bFN\b/i.test(r.method) ? " + fixed-node" : ", projected";
  if (r.bound_type === "extrapolated") s += ", extrapolated";
  if (r.defect) s += ", flagged";
  return s;
}
