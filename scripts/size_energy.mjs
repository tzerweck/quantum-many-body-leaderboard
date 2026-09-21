// Generate figures/energy/*.svg, the front page's view of every Hamiltonian: the published
// energies as they are, with no reference to measure them against (Tristan, 2026-09-17: the
// direct view instead of the relative gap). The shape is ladders.mjs's, which the site reads
// the same way: per model and lattice, stops along an axis (J2, U, the filling) grouped in
// facets, each stop a figure of one panel, energy against sites; and per figure with two
// stops or more one strip, the record at each stop and size, which the site puts above the
// panel as the slider that picks the stop (Tristan, 2026-09-18: one panel at a time, chosen
// on the coupling, instead of a stack of panels; 2026-09-21: one strip for the whole figure,
// the facets as groups along it, instead of a strip per facet). Per model one "other" figure for the Hamiltonians
// published at a single size that share no strip - every t-V instance is one of them - with
// a panel per set that shares lattice, boundary and size, the coupling or filling that
// varies along x.
//
// Energy is per site (the impurity problems in total energy) on a linear axis, lower is
// lower as in the cost figures. Every drawn row (ladders.mjs, drawnRows) is a mark coloured
// by its kind, filled where it can hold a record, slashed where the row is flagged, and a
// line joins the record at each size or coupling; a flagged row cannot hold a record
// (RULES.md 6.1), so the line passes it by. The directory is emptied first, as figures/cost/ is, so the site never
// inlines a figure whose panels have gone.
import fs from "node:fs";
import { recordEligible, perSiteDivisor, perSiteLabel } from "./units.mjs";
import { collect, recordOf, rowId } from "./summary.mjs";
import { energyFigures, drawnRows, STRIP } from "./ladders.mjs";
import { W, PAD, n, text, hline, dot, slashed, legend, header, doc, textWidth, wrap, niceStep, writer, logScale, rowHref } from "./chart.mjs";

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
    flagged: !!r.defect, eligible: !r.defect && (r.bound_type === "exact" || recordEligible(r)) }))));
  const recs = slots.map(s => [X(s), recordAt(s.members)]).filter(([, e]) => Number.isFinite(e));
  // A title too long for a narrow panel breaks onto a second line above the first.
  const lines = title ? wrap(title, 12, right - px) : [];
  lines.forEach((l, k) => parts.push(text(px, top - 14 - (lines.length - 1 - k) * 15, l, { size: 12, fill: t.ink, weight: 600 })));
  const Y = yAxis(t, parts, pts.map(p => p.e), box);
  xTicks(t, parts, slots.map(s => ({ x: X(s), label: s.label })), bottom);
  if (xLabel) parts.push(text(right, bottom + 32, xLabel, { size: 10.5, fill: t.ink2, anchor: "end" }));
  if (recs.length > 1)
    parts.push(`<path d="${recs.map(([x, e], k) => `${k ? "L" : "M"}${n(x)} ${n(Y(e))}`).join("")}" fill="none" stroke="${t.ink2}" stroke-width="1.5" stroke-linejoin="round" opacity="0.6"/>`);
  // Hollow under filled, exact energies on top of the bounds that sit on them, and the
  // flagged outlines last, over whatever they coincide with - set off to the right where a
  // sound mark would sit under them, as a flagged extrapolation tends to sit on the record.
  for (const p of [...pts].sort((a, b) => a.flagged - b.flagged || a.eligible - b.eligible || (a.r.bound_type === "exact") - (b.r.bound_type === "exact")))
    parts.push(p.flagged ? slashed(t, p.x + (pts.some(q => !q.flagged && q.x === p.x && Math.abs(Y(q.e) - Y(p.e)) < 14) ? 11 : 0), Y(p.e), t.series[KIND[p.r.bound_type]], rowHref(p.inst, p.r))
      : dot(t, p.x, Y(p.e), t.series[KIND[p.r.bound_type]], p.eligible, rowHref(p.inst, p.r)));
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
  { kind: "flag", color: t.ink2, label: "Flagged, see the row" },
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

// The figure's strip: the record at each stop and size, one line per size within each
// facet, the larger the darker, and over each stop a count mark as size_accuracy.mjs draws
// them, the number of energies the stop stands for inside, linking to them all for the
// site's list (largest size first, lowest energy first at a size). The cursor is a group
// per stop, hidden in the file and shown by the site's stylesheet for the chosen one.
//
// Hover states the site's stylesheet drives (Tristan, 2026-09-21). Each facet is a group
// (`grp`) and each stop a column in it (`col`: a hit area over the column, the stop's dots,
// its count mark), so that the pointer over a column hovers both. Over a group its size
// lines move apart, up by EX per size rank, so that seven lines coinciding at this scale
// read as seven (class `ex`, the shift in `--ex`; the size at each line's end `exl`) - only
// that group, not the figure. A dense group (more stops than DENSE) does not move apart, its
// lines being fragments that lose their dots, and has no hover state (a fan of the stop's
// sizes was tried and cut: unnecessary). The hit area (`hit`, with the stop's index) and
// the count mark both select the stop like its badge; the hit area sits under the marks so
// that a count mark keeps the pointer and its list. Only theme colours, at varying opacity,
// so that dark mode recolours the strip like any figure.
const EX = 7, HEADROOM = 42, COUNT_R = 6.5, DENSE = 10;
function stripFigure(f) {
  write(f.strip, t => {
    const { left, right, top, bottom, labelY } = STRIP, { stops } = f;
    const sizes = [...new Set(stops.flatMap(s => s.ladder.members.map(i => i.n_sites)))].sort((a, b) => a - b);
    const rank = N => sizes.length - 1 - sizes.indexOf(N);
    const shade = N => n(sizes.length > 1 ? 0.25 + 0.75 * (sizes.indexOf(N) / (sizes.length - 1)) : 1);
    const ex = Math.min(EX, HEADROOM / Math.max(1, sizes.length - 1));
    const recs = new Map(stops.map(s => [s, sizes.flatMap(N => {
      const e = recordAt(s.ladder.members.filter(i => i.n_sites === N));
      return Number.isFinite(e) ? [{ N, e }] : [];
    })]));
    // Where the count mark sits: on the record of the largest size, or, for a stop with
    // no record at any size (rows that cannot hold one), on its lowest energy there.
    const markAt = s => recs.get(s).at(-1)?.e ?? Math.min(...drawnRows(s.ladder.members.at(-1)).map(r => r.energy / perSite(s.ladder.members.at(-1))));
    const parts = [];
    const es = [...[...recs.values()].flat().map(p => p.e), ...stops.map(markAt)];
    const Y = yAxis(t, parts, es.length ? es : [-1, 0], STRIP);
    parts.push(text(left - 6, 18, perSiteLabel(stops[0].ladder.members[0]), { size: 10, fill: t.muted, anchor: "end" }));
    stops.forEach((s, k) => parts.push(`<g class="cur cur-${k}"><rect x="${n(s.x - 9)}" y="${top}" width="18" height="${bottom - top}" rx="4" fill="${t.series[0]}" opacity="0.12"/>` +
      `<path d="M${n(s.x)} ${top}V${bottom}" stroke="${t.series[0]}" stroke-width="1.5"/></g>`));
    for (const s of stops) parts.push(`<path d="M${n(s.x)} ${n(bottom)}v5" stroke="${t.muted}" stroke-width="1"/>`);
    // The facets as groups along the axis: each labelled over its stops, a hairline between
    // neighbours.
    f.facets.forEach((x, g) => {
      parts.push(text((x.stops[0].x + x.stops.at(-1).x) / 2, labelY, x.label, { size: 10.5, fill: t.ink2, anchor: "middle", weight: 600 }));
      if (g) parts.push(`<path d="M${n((f.facets[g - 1].stops.at(-1).x + x.stops[0].x) / 2)} ${labelY + 8}V${bottom}" stroke="${t.grid}" stroke-width="1" stroke-dasharray="3 3"/>`);
    });
    let k = 0;
    for (const x of f.facets) {
      const dense = x.stops.length > DENSE, inner = [];
      const shift = N => (dense ? "" : ` class="ex" style="--ex:${-rank(N) * ex}px"`);
      for (const N of sizes) {
        const pts = x.stops.flatMap(s => { const p = recs.get(s).find(p => p.N === N); return p ? [{ x: s.x, y: Y(p.e) }] : []; });
        if (!pts.length) continue;
        if (pts.length > 1) inner.push(`<path${shift(N)} d="${pts.map((p, k) => `${k ? "L" : "M"}${n(p.x)} ${n(p.y)}`).join("")}" fill="none" stroke="${t.ink}" stroke-width="1.5" stroke-linejoin="round" opacity="${n(0.8 * shade(N))}"/>`);
        if (!dense) inner.push(`<text class="ex exl" style="--ex:${-rank(N) * ex}px;--o:${shade(N)};font-variant-numeric:tabular-nums" x="${n(pts.at(-1).x + 7)}" y="${n(pts.at(-1).y + 3)}" font-size="7.5" fill="${t.ink2}">${N}</text>`);
      }
      for (const s of x.stops) {
        const y = Y(markAt(s));
        const col = [`<rect class="hit" data-stop="${k}" x="${n(s.x - f.pitch / 2)}" y="${labelY + 12}" width="${n(f.pitch)}" height="${n(bottom - labelY - 12)}" fill="transparent" pointer-events="all"/>`];
        for (const p of recs.get(s)) col.push(`<circle${shift(p.N)} cx="${n(s.x)}" cy="${n(Y(p.e))}" r="3.2" fill="${t.ink}" opacity="${shade(p.N)}"/>`);
        const rows = s.ladder.members.flatMap(inst => drawnRows(inst).map(r => ({ inst, r })))
          .sort((a, b) => b.inst.n_sites - a.inst.n_sites || a.r.energy / perSite(a.inst) - b.r.energy / perSite(b.inst));
        const head = `${rows.length} energies at ${f.axis} = ${s.label}, largest size first`;
        col.push(`<a class="pt" data-rows="${rows.map(p => rowId(p.inst, p.r)).join(" ")}" data-head="${head}" href="${rowHref(rows[0].inst, rows[0].r)}">` +
          `<circle cx="${n(s.x)}" cy="${n(y)}" r="${COUNT_R + 1.5}" fill="${t.surface}"/><circle cx="${n(s.x)}" cy="${n(y)}" r="${COUNT_R}" fill="${t.ink}"/>` +
          `<text x="${n(s.x)}" y="${n(y + 3)}" font-size="8.5" font-weight="600" fill="${t.surface}" text-anchor="middle" style="font-variant-numeric:tabular-nums">${rows.length}</text></a>`);
        inner.push(`<g class="col">${col.join("")}</g>`);
        k++;
      }
      parts.push(`<g class="grp">${inner.join("")}</g>`);
    }
    let lx = right;
    for (const N of [...sizes].reverse()) {
      lx -= textWidth(String(N), 10) + 20;
      parts.push(`<circle cx="${n(lx + 4)}" cy="14" r="3.2" fill="${t.ink}" opacity="${shade(N)}"/>`, text(lx + 11, 18, String(N), { size: 10, fill: t.ink2, nums: true }));
    }
    parts.push(text(lx - 6, 18, "record at each size:", { size: 10, fill: t.muted, anchor: "end" }));
    parts.push(text(right, bottom + 16, f.axis, { size: 10.5, fill: t.ink2, anchor: "end" }));
    const title = `${f.title}: the record at each ${f.axis} and size`;
    return doc(t, bottom + 24, title, stops.map(s => `${f.axis} = ${s.label}`).join(", "), parts);
  });
}

for (const f of figures) {
  if (f.group !== "other") {
    if (f.strip) stripFigure(f);
    for (const facet of f.facets) for (const s of facet.stops) stopFigure(f, facet, s);
    continue;
  }
  // The "other" figure: the varying quantity along x, evenly spaced. Title alone, no footnote
  // (Tristan, 2026-09-18); the per-site label above the panels says the unit.
  write(f.name, t => {
    const specs = f.scans.map(s => ({ title: s.label, slots: s.slots, xLabel: s.x }));
    const h = header(t, f.title, "Every Hamiltonian of this model with energies published at only one size and no strip to join, grouped where they " +
      "share lattice, boundary and size; the coupling or filling that differs between them runs along x. Colour is the kind of number; filled marks can hold a record, hollow ones cannot, and a slashed mark is a flagged row.");
    const lg = legend(t, LEGEND(t), h.bottom + 34);
    const parts = [h.svg, lg.svg];
    parts.push(text(W - PAD, lg.bottom + 30, perSiteLabel(f.scans[0].slots[0].members[0]), { size: 11, fill: t.muted, anchor: "end" }));
    const end = grid(t, parts, specs, lg.bottom + 70, 3);
    return doc(t, end + 50, f.title, specs.map(s => `${s.title}: ${s.slots.map(x => x.label).join(", ")}`).join("; "), parts);
  });
}

const sliders = figures.filter(f => f.group !== "other");
const strips = sliders.filter(f => f.strip).length;
const stops = sliders.reduce((a, f) => a + f.stops.length, 0);
console.log(`${DIR}/: ${written.length} files (${sliders.length} figures with ${strips} strips and ${stops} stops; ` +
  `${figures.length - sliders.length} other figures with ${figures.reduce((a, f) => a + (f.scans?.length ?? 0), 0)} panels)`);
