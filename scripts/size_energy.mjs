// Generate figures/energy/*.svg, the front page's view of every Hamiltonian: the published
// energies as they are, with no reference to measure them against (Tristan, 2026-09-17: the
// direct view instead of the relative gap). The shape is ladders.mjs's, which the site reads
// the same way: per model and lattice, facets of stops along an axis (J2, U, the filling),
// each stop a figure of one panel, energy against sites; and per facet with two stops or
// more a strip, the record at each stop and size, which the site puts above the panel as
// the slider that picks the stop (Tristan, 2026-09-18: one panel at a time, chosen on the
// coupling, instead of a stack of panels). Per model one "other" figure for the Hamiltonians
// published at a single size that share no strip - every t-V instance is one of them - with
// a panel per set that shares lattice, boundary and size, the coupling or filling that
// varies along x.
//
// Energy is per site (the impurity problems in total energy) on a linear axis, lower is
// lower as in the cost figures. Every drawn row (ladders.mjs, drawnRows) is a mark coloured
// by its kind, filled where it can hold a record, and a line joins the record at each size
// or coupling. The directory is emptied first, as figures/cost/ is, so the site never
// inlines a figure whose panels have gone.
import fs from "node:fs";
import { recordEligible, perSiteDivisor, perSiteLabel } from "./units.mjs";
import { collect, recordOf } from "./summary.mjs";
import { energyFigures, drawnRows, STRIP, stripX } from "./ladders.mjs";
import { W, PAD, n, text, hline, dot, legend, header, doc, textWidth, wrap, niceStep, writer, logScale, rowHref } from "./chart.mjs";

const OUT = "figures";
const DIR = `${OUT}/energy`;
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
const { write, written } = writer(OUT);
const figures = energyFigures(collect());

const KIND = { variational: 0, projected: 1, extrapolated: 2, exact: 3 };
const perSite = inst => perSiteDivisor(inst) ?? 1;
// The lowest record per site among instances drawn at one x; Infinity where none has one.
const recordAt = insts => Math.min(...insts.flatMap(i => { const r = recordOf(i); return r ? [r.energy / perSite(i)] : []; }));

// Tick labels along x, dropped where one would run into the previous.
function xTicks(t, parts, ticks, bottom) {
  let lastEnd = -Infinity;
  for (const { x, label } of ticks) {
    parts.push(`<path d="M${n(x)} ${n(bottom)}v4" stroke="${t.grid}" stroke-width="1"/>`);
    const w = textWidth(label, 10.5);
    if (!label || x - w / 2 < lastEnd + 5) continue;
    parts.push(text(x, bottom + 17, label, { size: 10.5, fill: t.muted, anchor: "middle", nums: true }));
    lastEnd = x + w / 2;
  }
}

// A linear energy axis over `es` with its grid and labels; returns the scale.
function yAxis(t, parts, es, { left, right, top, bottom }) {
  const lo = Math.min(...es), hi = Math.max(...es);
  const span = Math.max(hi - lo, Math.abs(hi + lo) * 1e-3, 1e-6), step = niceStep(span / 4);
  const e0 = Math.floor((lo - span * 0.08) / step) * step, e1 = Math.ceil((hi + span * 0.08) / step) * step;
  const Y = e => bottom - ((e - e0) / (e1 - e0)) * (bottom - top);
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  for (let k = 0; k <= Math.round((e1 - e0) / step); k++) {
    const v = e0 + k * step;
    parts.push(hline(left, right, Y(v), t.grid));
    parts.push(text(left - 6, Y(v) + 4, v.toFixed(decimals).replace("-", "−"), { size: 10, fill: t.muted, anchor: "end", nums: true }));
  }
  return Y;
}

// One panel: `slots` are the x positions, each with the instances drawn there.
function panel(t, parts, { title, slots, X, xLabel }, box) {
  const { px, left, right, top, bottom } = box;
  const pts = slots.flatMap(s => s.members.flatMap(inst => drawnRows(inst).map(r => ({ r, inst, x: X(s), e: r.energy / perSite(inst),
    eligible: r.bound_type === "exact" || recordEligible(r) }))));
  const recs = slots.map(s => [X(s), recordAt(s.members)]).filter(([, e]) => Number.isFinite(e));
  // A title too long for a narrow panel breaks onto a second line above the first.
  const lines = title ? wrap(title, 12, right - px) : [];
  lines.forEach((l, k) => parts.push(text(px, top - 14 - (lines.length - 1 - k) * 15, l, { size: 12, fill: t.ink, weight: 600 })));
  const Y = yAxis(t, parts, pts.map(p => p.e), box);
  xTicks(t, parts, slots.map(s => ({ x: X(s), label: s.label })), bottom);
  if (xLabel) parts.push(text(right, bottom + 32, xLabel, { size: 10.5, fill: t.ink2, anchor: "end" }));
  if (recs.length > 1)
    parts.push(`<path d="${recs.map(([x, e], k) => `${k ? "L" : "M"}${n(x)} ${n(Y(e))}`).join("")}" fill="none" stroke="${t.ink2}" stroke-width="1.5" stroke-linejoin="round" opacity="0.6"/>`);
  // Hollow under filled, exact energies on top of the bounds that sit on them.
  for (const p of [...pts].sort((a, b) => a.eligible - b.eligible || (a.r.bound_type === "exact") - (b.r.bound_type === "exact")))
    parts.push(dot(t, p.x, Y(p.e), t.series[KIND[p.r.bound_type]], p.eligible, rowHref(p.inst, p.r)));
}

// Panels in `cols` columns; returns the y below the last row. Sites sit on a log scale, a
// varying coupling or filling at even spacing in its own order.
function grid(t, parts, specs, top0, cols, plotH = 170) {
  const gap = 40, pitch = plotH + 84, panelW = (W - 2 * PAD - gap * (cols - 1)) / cols;
  specs.forEach((spec, k) => {
    const px = PAD + (k % cols) * (panelW + gap), top = top0 + Math.floor(k / cols) * pitch;
    const box = { px, left: px + 56, right: px + panelW - 4, top, bottom: top + plotH };
    const sites = logScale(spec.slots[0].at / 1.5, spec.slots.at(-1).at * 1.5, box.left, box.right);
    const X = spec.log ? s => sites(s.at) : s => box.left + ((spec.slots.indexOf(s) + 0.5) / spec.slots.length) * (box.right - box.left);
    panel(t, parts, { ...spec, X }, box);
  });
  return top0 + (Math.ceil(specs.length / cols) - 1) * pitch + plotH;
}

const LEGEND = t => [
  { kind: "dot", color: t.series[0], label: "Variational bound" },
  { kind: "dot", color: t.series[1], label: "Projected" },
  { kind: "dot", color: t.series[2], label: "Extrapolated" },
  { kind: "dot", color: t.series[3], label: "Exact" },
  { kind: "ring", color: t.ink2, label: "Cannot hold a record" },
  { kind: "line", color: t.ink2, label: "Record" },
];

// A stop: its ladder alone, full width. The title is the model and lattice, the facet and
// the stop, with no subtitle and no footnote (Tristan, 2026-09-18): the legend says what the
// marks are and the per-site label above the panel says the unit.
function stopFigure(f, facet, s) {
  write(s.name, t => {
    const L = s.ladder;
    const slots = [...Map.groupBy(L.members, i => i.n_sites)].map(([N, members]) => ({ at: N, label: String(N), members }));
    const title = [f.title, facet.label, f.axis && `${f.axis} = ${s.label}`].filter(Boolean).join(", ");
    const h = header(t, title, "");
    const lg = legend(t, LEGEND(t), h.bottom + 34);
    const parts = [h.svg, lg.svg, text(W - PAD, lg.bottom + 30, perSiteLabel(L.members[0]), { size: 11, fill: t.muted, anchor: "end" })];
    const end = grid(t, parts, [{ title: "", log: true, xLabel: "sites", slots }], lg.bottom + 50, 1, 250);
    return doc(t, end + 50, title, slots.map(x => x.label).join(", "), parts);
  });
}

// A facet's strip: the record at each stop and size, one line per size, the larger the
// darker. The cursor is a group per stop, hidden in the file and shown by the site's
// stylesheet for the chosen one. Only theme colours, at varying opacity, so that dark mode
// recolours the strip like any figure.
function stripFigure(f, facet) {
  write(facet.strip, t => {
    const { left, right, top, bottom } = STRIP, stops = facet.stops;
    const X = k => stripX(k, stops.length);
    const sizes = [...new Set(stops.flatMap(s => s.ladder.members.map(i => i.n_sites)))].sort((a, b) => a - b);
    const shade = N => n(sizes.length > 1 ? 0.25 + 0.75 * (sizes.indexOf(N) / (sizes.length - 1)) : 1);
    const series = sizes.map(N => ({ N, pts: stops.flatMap((s, k) => {
      const e = recordAt(s.ladder.members.filter(i => i.n_sites === N));
      return Number.isFinite(e) ? [{ x: X(k), e }] : [];
    }) }));
    const parts = [];
    const es = series.flatMap(s => s.pts.map(p => p.e));
    const Y = yAxis(t, parts, es.length ? es : [-1, 0], STRIP);
    parts.push(text(left - 6, 18, perSiteLabel(stops[0].ladder.members[0]), { size: 10, fill: t.muted, anchor: "end" }));
    stops.forEach((s, k) => parts.push(`<g class="cur cur-${k}"><rect x="${n(X(k) - 9)}" y="${top}" width="18" height="${bottom - top}" rx="4" fill="${t.series[0]}" opacity="0.12"/>` +
      `<path d="M${n(X(k))} ${top}V${bottom}" stroke="${t.series[0]}" stroke-width="1.5"/></g>`));
    stops.forEach((s, k) => parts.push(`<path d="M${n(X(k))} ${n(bottom)}v5" stroke="${t.muted}" stroke-width="1"/>`));
    for (const s of series) {
      if (s.pts.length > 1) parts.push(`<path d="${s.pts.map((p, k) => `${k ? "L" : "M"}${n(p.x)} ${n(Y(p.e))}`).join("")}" fill="none" stroke="${t.ink}" stroke-width="1.5" stroke-linejoin="round" opacity="${n(0.8 * shade(s.N))}"/>`);
      for (const p of s.pts) parts.push(`<circle cx="${n(p.x)}" cy="${n(Y(p.e))}" r="3.2" fill="${t.ink}" opacity="${shade(s.N)}"/>`);
    }
    let lx = right;
    for (const N of [...sizes].reverse()) {
      lx -= textWidth(String(N), 10) + 20;
      parts.push(`<circle cx="${n(lx + 4)}" cy="14" r="3.2" fill="${t.ink}" opacity="${shade(N)}"/>`, text(lx + 11, 18, String(N), { size: 10, fill: t.ink2, nums: true }));
    }
    parts.push(text(lx - 6, 18, "record at each size:", { size: 10, fill: t.muted, anchor: "end" }));
    parts.push(text(right, bottom + 16, f.axis, { size: 10.5, fill: t.ink2, anchor: "end" }));
    const title = `${[f.title, facet.label].filter(Boolean).join(", ")}: the record at each ${f.axis} and size`;
    return doc(t, bottom + 24, title, stops.map(s => `${f.axis} = ${s.label}`).join(", "), parts);
  });
}

for (const f of figures) {
  if (f.group !== "other") {
    for (const facet of f.facets) {
      if (facet.strip) stripFigure(f, facet);
      for (const s of facet.stops) stopFigure(f, facet, s);
    }
    continue;
  }
  // The "other" figure: the varying quantity along x, evenly spaced. Title alone, no footnote
  // (Tristan, 2026-09-18); the per-site label above the panels says the unit.
  write(f.name, t => {
    const specs = f.scans.map(s => ({ title: s.label, slots: s.slots, xLabel: s.x }));
    const h = header(t, f.title, "Every Hamiltonian of this model with energies published at only one size and no strip to join, grouped where they " +
      "share lattice, boundary and size; the coupling or filling that differs between them runs along x. Colour is the kind of number; filled marks can hold a record, hollow ones cannot.");
    const lg = legend(t, LEGEND(t), h.bottom + 34);
    const parts = [h.svg, lg.svg];
    parts.push(text(W - PAD, lg.bottom + 30, perSiteLabel(f.scans[0].slots[0].members[0]), { size: 11, fill: t.muted, anchor: "end" }));
    const end = grid(t, parts, specs, lg.bottom + 70, 3);
    return doc(t, end + 50, f.title, specs.map(s => `${s.title}: ${s.slots.map(x => x.label).join(", ")}`).join("; "), parts);
  });
}

const sliders = figures.filter(f => f.group !== "other");
const strips = sliders.reduce((a, f) => a + f.facets.filter(x => x.strip).length, 0);
const stops = sliders.reduce((a, f) => a + f.facets.reduce((b, x) => b + x.stops.length, 0), 0);
console.log(`${DIR}/: ${written.length} files (${sliders.length} figures with ${strips} strips and ${stops} stops; ` +
  `${figures.length - sliders.length} other figures with ${figures.reduce((a, f) => a + (f.scans?.length ?? 0), 0)} panels)`);
