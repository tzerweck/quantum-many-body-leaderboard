// Generate figures/energy/*.svg, the front page's view of every Hamiltonian: the published
// energies as they are, with no reference to measure them against (Tristan, 2026-09-17: the
// direct view instead of the relative gap). One figure per model and lattice with a panel per
// ladder of sizes, sites along x; and per model one "other" figure for the Hamiltonians
// published at a single size - every t-V instance is one of them - with a panel per set that
// shares lattice, boundary and size, the coupling or filling that varies along x. The
// grouping is ladders.mjs's, which the site reads the same way.
//
// Energy is per site (the impurity problems in total energy) on a linear axis, lower is
// lower as in the cost figures. Every drawn row (ladders.mjs, drawnRows) is a mark coloured
// by its kind, filled where it can hold a record, and a line joins the record at each size
// or coupling. The directory is emptied first, as figures/cost/ is, so the site never
// inlines a figure whose panels have gone.
import fs from "node:fs";
import { recordEligible, perSiteDivisor, perSiteLabel } from "./units.mjs";
import { collect, recordOf } from "./summary.mjs";
import { energyFigures, drawnRows } from "./ladders.mjs";
import { W, PAD, n, text, hline, dot, legend, header, footnote, doc, textWidth, wrap, niceStep, writer, logScale, rowHref } from "./chart.mjs";

const OUT = "figures";
const DIR = `${OUT}/energy`;
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
const { write, written } = writer(OUT);
const figures = energyFigures(collect());

const KIND = { variational: 0, projected: 1, extrapolated: 2, exact: 3 };
const perSite = inst => perSiteDivisor(inst) ?? 1;

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

// One panel: `slots` are the x positions, each with the instances drawn there.
function panel(t, parts, { title, slots, X, xLabel }, { px, left, right, top, bottom }) {
  const pts = slots.flatMap(s => s.members.flatMap(inst => drawnRows(inst).map(r => ({ r, inst, x: X(s), e: r.energy / perSite(inst),
    eligible: r.bound_type === "exact" || recordEligible(r) }))));
  const recs = slots.map(s => [X(s), Math.min(...s.members.map(recordOf).filter(Boolean).map((r, k) => r.energy / perSite(s.members[k])))])
    .filter(([, e]) => Number.isFinite(e));
  // A title too long for a narrow panel breaks onto a second line above the first.
  const lines = wrap(title, 12, right - px);
  lines.forEach((l, k) => parts.push(text(px, top - 14 - (lines.length - 1 - k) * 15, l, { size: 12, fill: t.ink, weight: 600 })));
  const es = pts.map(p => p.e), lo = Math.min(...es), hi = Math.max(...es);
  const span = Math.max(hi - lo, Math.abs(hi + lo) * 1e-3, 1e-6), step = niceStep(span / 4);
  const e0 = Math.floor((lo - span * 0.08) / step) * step, e1 = Math.ceil((hi + span * 0.08) / step) * step;
  const Y = e => bottom - ((e - e0) / (e1 - e0)) * (bottom - top);
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  for (let k = 0; k <= Math.round((e1 - e0) / step); k++) {
    const v = e0 + k * step;
    parts.push(hline(left, right, Y(v), t.grid));
    parts.push(text(left - 6, Y(v) + 4, v.toFixed(decimals).replace("-", "−"), { size: 10, fill: t.muted, anchor: "end", nums: true }));
  }
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
function grid(t, parts, specs, top0, cols) {
  const gap = 40, plotH = 170, pitch = plotH + 84, panelW = (W - 2 * PAD - gap * (cols - 1)) / cols;
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

for (const f of figures) write(f.name, t => {
  const other = f.group === "other";
  // Ladders: sites along x on a log scale. Others: the varying quantity, evenly spaced.
  const specs = other
    ? f.scans.map(s => ({ title: s.label, slots: s.slots, xLabel: s.x }))
    : f.ladders.map(L => {
      const slots = [...Map.groupBy(L.members, i => i.n_sites)].map(([N, members]) => ({ at: N, label: String(N), members }));
      const count = L.members.reduce((a, i) => a + drawnRows(i).length, 0);
      return { title: [L.label, `${count} energies at ${slots.length} sizes`].filter(Boolean).join(": "), log: true, xLabel: "sites", slots };
    });
  const title = other ? f.title : `${f.title}: the published energies at each size`;
  const h = header(t, title, other
    ? "Every Hamiltonian of this model with energies published at only one size, grouped where they share lattice, boundary and size; the coupling or filling that differs between them runs along x. Colour is the kind of number; filled marks can hold a record, hollow ones cannot."
    : "One panel per Hamiltonian, at every size with a published energy. Colour is the kind of number; filled marks can hold a record, hollow ones cannot; the line joins the record at each size.");
  const lg = legend(t, LEGEND(t), h.bottom + 34);
  const parts = [h.svg, lg.svg];
  parts.push(text(W - PAD, lg.bottom + 30, perSiteLabel(f.ladders?.[0].members[0] ?? f.scans[0].slots[0].members[0]), { size: 11, fill: t.muted, anchor: "end" }));
  const end = grid(t, parts, specs, lg.bottom + 70, other ? 3 : specs.length === 1 ? 1 : 2);
  const fn = footnote(t, "Energies per site as the table quotes them (the impurity problems in total energy), on each panel's own linear scale. " +
    "Flagged rows, rows without a declared kind and exact diagonalizations of a single symmetry sector are not drawn.", end + 50);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, title, specs.map(s => `${s.title}: ${s.slots.map(x => x.label).join(", ")}`).join("; "), parts);
});

console.log(`${DIR}/: ${written.length} files (${figures.filter(f => f.group !== "other").length} figures with ${figures.reduce((a, f) => a + (f.ladders?.length ?? 0), 0)} ladders; ` +
  `${figures.filter(f => f.group === "other").length} other figures with ${figures.reduce((a, f) => a + (f.scans?.length ?? 0), 0)} panels)`);
