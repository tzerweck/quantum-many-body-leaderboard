// Generate figures/energy-vs-compute*.svg, figures/energy-vs-parameters*.svg and one
// figures/cost/<instance>*.svg per instance with enough costed energies: on one
// instance, what the best published energies are at each cost. The question is not how
// far a number sits from the exact answer but which results are the best ones (Tristan,
// 2026-09-16), so the axis is the energy itself and the frontier runs through whatever
// holds it at each cost - an exact diagonalization with its CPU-hours as readily as a
// variational bound with its GPU-hours. Panels are per instance, as energies of different
// Hamiltonians are not comparable, and only instances with enough costed rows are drawn.
//
// Costs come from the `compute` blocks (DATA.md) and only from them, read by cost.mjs.
// Three axes: hours, parameter count, and estimated FLOPs. A GPU-hour and a CPU core-hour
// share the hours axis with different marks and are never converted into each other - the
// reader sees the unit, and DATA.md forbids any equivalence. The FLOPs axis is an estimate
// evaluated by flops.mjs from the stated parameter, sample and iteration counts (Tristan,
// 2026-09-21); it is drawn in its own figures and never on the hours axis, since turning
// one into the other is the conversion DATA.md forbids. The per-instance figures are hours
// (figures/cost/) and estimated FLOPs (figures/flops/): cost means compute (Tristan,
// 2026-09-16), and they are what the site shows, on the front page behind a badge per
// instance and in the instance's row of the table.
//
// The frontier is the staircase of results nothing beats for less: sorted by cost, a row
// is on it when its energy is below every cheaper row that could hold a record (RULES.md
// 6: a strict bound with an error bar, or a ground-state exact energy). Projections and
// extrapolations are drawn but never on the frontier, as they are not bounds.
import fs from "node:fs";
import { recordEligible, exactEligible, boundLabel, perSiteDivisor, perSiteLabel } from "./units.mjs";
import { collect, recordOf } from "./summary.mjs";
import { hoursOf, parametersOf, MIN_COSTED, costFigureName, flopsFigureName } from "./cost.mjs";
import { estimatedFlopsOf } from "./flops.mjs";
import { W, PAD, n, text, hline, dot, legend, header, footnote, doc, textWidth, niceStep, writer, log, logScale, pow10, shortLabel, rowHref, linked } from "./chart.mjs";

const OUT = "figures";
const instances = collect();
const { write, written } = writer(OUT);
const BOUNDS = { variational: 0, projected: 1, extrapolated: 2, exact: 3 };


const MODEL = { J1J2: "J1-J2", Heisenberg: "Heisenberg", Hubbard: "Hubbard", TFIsing: "TFIM", tV: "t-V", Impurity: "impurity" };
function instLabel(i) {
  const side = Math.sqrt(i.n_sites);
  const lat = i.lattice.replace(/^rectangular-/, "").replace(/^square$/, Number.isInteger(side) ? `${side}×${side}` : "square");
  const extra = i.params.J2 != null ? `, J2 = ${i.params.J2}` : i.params.U != null ? `, U = ${i.params.U}, n = ${(2 * i.params.Nf / i.n_sites).toFixed(3).replace(/0+$/, "")}` : "";
  const bc = { O: ", open", PO: ", cylinder", PA: ", periodic-antiperiodic", A: ", antiperiodic" }[i.boundary] ?? "";
  return `${MODEL[i.model] ?? i.model} ${lat}${/×|x/.test(lat) ? "" : ` ${i.n_sites}`}${extra}${bc}`;
}

// The costed rows of an instance under one cost accessor, which sees the compute block,
// the row and the instance (an estimate needs all three). A row on the frontier can hold
// a record; exact rows count only when they state the ground state.
function costed(inst, costOf) {
  const f = perSiteDivisor(inst);
  return inst.rows.filter(r => r.bound_type in BOUNDS && !r.defect).flatMap(r => {
    const cost = costOf(r.compute, r, inst);
    if (!cost || !(r.bound_type !== "exact" || exactEligible(r))) return [];
    return [{ r, inst, cost, e: r.energy / f, eligible: r.bound_type === "exact" ? exactEligible(r) : recordEligible(r) }];
  });
}
function frontierOf(pts) {
  const out = [];
  let best = Infinity;
  for (const p of [...pts].sort((a, b) => a.cost.value - b.cost.value || a.e - b.e)) {
    if (!p.eligible) continue;
    if (p.e < best) { best = p.e; out.push(p); }
  }
  return out;
}

// Square marks for CPU core-hours, circles for everything else. Every result is a mark and
// only a mark (Tristan, 2026-09-23): no whisker for a derived cost, which the footnote counts
// instead. Same surface ring and filled/hollow convention as dot().
function mark(t, x, y, color, filled, unit, href) {
  const out = [];
  if (unit === "cpu") {
    out.push(`<rect x="${n(x - 6.5)}" y="${n(y - 6.5)}" width="13" height="13" rx="2" fill="${t.surface}"/>`);
    out.push(filled
      ? `<rect x="${n(x - 4.5)}" y="${n(y - 4.5)}" width="9" height="9" rx="1.5" fill="${color}"/>`
      : `<rect x="${n(x - 4)}" y="${n(y - 4)}" width="8" height="8" rx="1.5" fill="${t.surface}" stroke="${color}" stroke-width="2"/>`);
  } else out.push(dot(t, x, y, color, filled));
  return linked(href, out.join(""));
}

// One instance's energies against their cost, into the box given: the energy axis is
// linear and per site, the cost axis logarithmic, the frontier as a staircase with its
// points named. Every result is a dot - an exact diagonalization or a QMC energy as much as
// a variational one - and only a result with a cost can be placed; a record that states no
// cost is named in a line of text under the axis, never drawn as a line across it
// (Tristan, 2026-09-23). QMBL's own runs are all named, so none is read as published.
function drawPanel(t, parts, inst, pts, { px, left, right, top, bottom, xLabel, title, nameOwn = false }) {
  const plotH = bottom - top;
    const rec = recordOf(inst), recE = rec ? rec.energy / perSiteDivisor(inst) : null;
    const front = frontierOf(pts);
    if (title) parts.push(text(px, top - 14, title, { size: 12.5, fill: t.ink, weight: 600 }));
    parts.push(text(right, top - 14, perSiteLabel(inst), { size: 9.5, fill: t.muted, anchor: "end" }));
    // Cost axis: a decade either side of the data. Energy axis: linear, as in the
    // record-over-time figure, so the record and an exact energy sit where they are.
    const cs = pts.map(p => p.cost.value);
    const x0 = 10 ** Math.floor(log(Math.min(...cs)) - 0.5), x1 = 10 ** Math.ceil(log(Math.max(...cs)) + 0.5);
    const X = logScale(x0, x1, left, right);
    const es = pts.map(p => p.e);
    const span = Math.max(Math.max(...es) - Math.min(...es), 1e-6);
    const step = niceStep(span / 4);
    const e0 = Math.floor((Math.min(...es) - span * 0.08) / step) * step;
    const e1 = Math.ceil((Math.max(...es) + span * 0.08) / step) * step;
    const Y = e => bottom - ((e - e0) / (e1 - e0)) * plotH;
    const decimals = Math.max(0, -Math.floor(Math.log10(step)));
    for (let i = 0; i <= Math.round((e1 - e0) / step); i++) {
      const v = e0 + i * step;
      parts.push(hline(left, right, Y(v), t.grid));
      parts.push(text(left - 6, Y(v) + 4, v.toFixed(decimals).replace("-", "−"), { size: 10, fill: t.muted, anchor: "end", nums: true }));
    }
    for (let k2 = Math.ceil(log(x0)); k2 <= Math.floor(log(x1)); k2++)
      parts.push(text(X(10 ** k2), bottom + 16, pow10(k2), { size: 10, fill: t.muted, anchor: "middle", nums: true }));
    if (front.length > 1) {
      let d = `M${n(X(front[0].cost.value))} ${n(Y(front[0].e))}`;
      for (const p of front.slice(1)) d += `H${n(X(p.cost.value))}V${n(Y(p.e))}`;
      parts.push(`<path d="${d}" fill="none" stroke="${t.series[0]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.7"/>`);
    }
    for (const p of [...pts].sort((a, b) => a.eligible - b.eligible))
      parts.push(mark(t, X(p.cost.value), Y(p.e), t.series[BOUNDS[p.r.bound_type]], p.eligible, p.cost.unit, rowHref(p.inst, p.r)));
    // Frontier points and QMBL's own runs are named; the label goes right of the mark, or
    // left at the edge, and is nudged down where it would sit on the previous one.
    // Every QMBL run is named in an instance's own figure; the small overview panels name
    // the frontier only, where naming them all piles the labels on each other.
    const named = new Set([...front, ...(nameOwn ? pts.filter(p => p.r.computed_by === "qmbl") : [])]);
    // A label may not run across another mark: of the two sides the one it fits on and that
    // covers fewer marks wins (a "ViT (QMBL)" label over a published ViT's dot reads as ours).
    const centres = pts.map(p => [X(p.cost.value), Y(p.e)]);
    const covers = (x0, x1, y, self) => centres.filter(([cx, cy]) => !(cx === self?.[0] && cy === self?.[1]) && cx + 6 > x0 && cx - 6 < x1 && Math.abs(cy - y) < 9).length;
    const labels = [...named].map(p => {
      const s = shortLabel(p.r), w = textWidth(s, 10.5), x = X(p.cost.value), y = Y(p.e);
      // Beside the mark on the right, then the left, then above or below it; the first that
      // fits the plot and covers no other mark, else the one covering fewest.
      const spots = [
        { x0: x + 10, x1: x + 10 + w, ty: y, anchor: "start", lx: x + 10 },
        { x0: x - 10 - w, x1: x - 10, ty: y, anchor: "end", lx: x - 10 },
        { x0: x - 4, x1: x - 4 + w, ty: y - 20, anchor: "start", lx: x - 4 },
        { x0: x - 4, x1: x - 4 + w, ty: y + 16, anchor: "start", lx: x - 4 },
      ].filter(c => c.x0 >= left && c.x1 <= right);
      const hits = c => covers(c.x0, c.x1, c.ty, [x, y]);
      const pick = spots.find(c => hits(c) === 0) ?? spots.sort((c1, c2) => hits(c1) - hits(c2))[0] ?? { lx: x + 10, anchor: "start", ty: y };
      return { s, w, x: pick.lx, anchor: pick.anchor, y: pick.ty + 4 };
    }).sort((a, b) => a.y - b.y);
    // Nudged down only past labels they actually overlap, horizontally as well as vertically.
    const extent = l => l.anchor === "start" ? [l.x, l.x + l.w] : [l.x - l.w, l.x];
    for (let a = 1; a < labels.length; a++) {
      const [a0, a1] = extent(labels[a]);
      for (let b = 0; b < a; b++) {
        const [b0, b1] = extent(labels[b]);
        if (a0 < b1 && b0 < a1 && Math.abs(labels[a].y - labels[b].y) < 12) labels[a].y = labels[b].y + 12;
      }
    }
    for (const l of labels) parts.push(text(l.x, l.y, l.s, { size: 10.5, fill: t.ink2, anchor: l.anchor }));
    parts.push(text((left + right) / 2, bottom + 32, xLabel, { size: 10.5, fill: t.ink2, anchor: "middle" }));
    if (rec && !pts.some(p => p.r === rec))
      parts.push(text(left, bottom + 48, `${rec.bound_type === "exact" ? boundLabel(rec) : "record"}: ${recE.toFixed(6).replace("-", "−")} (${shortLabel(rec)}), no cost stated, not drawn`, { size: 9.5, fill: t.muted }));
}

function costFigure({ name, title, subtitle, costOf, minRows, xLabel, legendItems, footer, describe }) {
  const panels = instances.map(inst => ({ inst, pts: costed(inst, costOf) })).filter(p => p.pts.length >= minRows)
    .sort((a, b) => b.pts.length - a.pts.length || a.inst.instance_id.localeCompare(b.inst.instance_id));
  write(name, t => {
    const cols = 3, plotH = 170, pitch = plotH + 92, panelW = (W - 2 * PAD - 2 * 30) / cols;
    const h = header(t, title, subtitle(panels));
    const lg = legend(t, legendItems(t), h.bottom + 34);
    const top0 = lg.bottom + 46;
    const parts = [h.svg, lg.svg];
    panels.forEach(({ inst, pts }, k) => {
      const col = k % cols, row = Math.floor(k / cols);
      const px = PAD + col * (panelW + 30), left = px + 54, right = px + panelW - 4;
      const top = top0 + row * pitch, bottom = top + plotH;
      drawPanel(t, parts, inst, pts, { px, left, right, top, bottom, xLabel, title: instLabel(inst) });
    });
    const y = top0 + (Math.ceil(panels.length / cols) - 1) * pitch + plotH + 70;
    const fn = footnote(t, footer(panels), y);
    parts.push(fn.svg);
    return doc(t, fn.bottom + 24, title, describe(panels), parts);
  });
  return panels;
}

const HOURS_LEGEND = t => [
  { kind: "dot", color: t.series[0], label: "Variational bound" },
  { kind: "dot", color: t.series[1], label: "Projected" },
  { kind: "dot", color: t.series[2], label: "Extrapolated" },
  { kind: "dot", color: t.series[3], label: "Exact" },
  { kind: "ring", color: t.ink2, label: "Cannot hold a record" },
  { kind: "line", color: t.series[0], label: "Frontier" },
];
// The marks, the derived hours and QMBL's own runs (Tristan, 2026-09-18 and 09-23): the
// no-conversion rule and the bound kinds are said in the page text and the legend.
function HOURS_FOOTER(all, overview = false) {
  const cpu = all.filter(p => p.cost.unit === "cpu").length, der = all.filter(p => p.cost.derived).length;
  const own = all.filter(p => p.r.computed_by === "qmbl").length;
  const rows = k => `${k} row${k === 1 ? "" : "s"}`;
  return (cpu ? `Circles are GPU-hours, squares CPU core-hours (${rows(cpu)}).` : "Every mark is GPU-hours.") +
    (der ? ` For ${rows(der)} the hours are devices × wall-clock, multiplied here.` : "") +
    (own ? ` Labels marked QMBL are QMBL's own reference runs, measured on one A100 80 GB or 8 CPU cores (${rows(own)})${overview ? "; each instance's own figure names all of them" : ""}.` : "");
}
const describeHours = panels => panels.map(({ inst, pts }) => `${instLabel(inst)}: ${pts.map(p => `${shortLabel(p.r)} ${Math.round(p.cost.value)} ${p.cost.unit === "cpu" ? "CPU-h" : "GPU-h"}${p.cost.derived ? " (derived)" : ""} ${p.e.toFixed(6)}`).join(", ")}`).join("; ");

const hoursPanels = costFigure({
  name: "energy-vs-compute",
  title: "The best energies at each cost, instance by instance",
  subtitle: panels => `Every energy whose paper, or QMBL's own run, states what it cost in hours, on the ${panels.length} instances with at least two such rows. ` +
    "The line is the frontier: the results nothing beats for less. Colour is the kind of number; filled marks can hold a record, hollow ones cannot.",
  costOf: hoursOf, minRows: MIN_COSTED,
  xLabel: "hours, as reported",
  legendItems: HOURS_LEGEND,
  footer: panels => HOURS_FOOTER(panels.flatMap(p => p.pts), true),
  describe: describeHours,
});

// One figure per instance with at least MIN_COSTED energies costed in hours. The directory
// is emptied first, so an instance that loses a cost loses its figure rather than keeping
// a stale one the site would still inline.
const COST_DIR = "figures/cost";
fs.rmSync(COST_DIR, { recursive: true, force: true });
fs.mkdirSync(COST_DIR, { recursive: true });
const own = writer("figures");
for (const { inst, pts } of hoursPanels) {
  const name = costFigureName(inst);
  const title = `${instLabel(inst)}: the best energies at each cost`;
  own.write(name, t => {
    const h = header(t, title, "Every energy on this instance whose paper, or QMBL's own run, states what it cost in hours. " +
      "The line is the frontier: the results nothing beats for less.");
    const lg = legend(t, HOURS_LEGEND(t), h.bottom + 34);
    const top = lg.bottom + 36, bottom = top + 300, left = PAD + 66, right = W - PAD - 8;
    const parts = [h.svg, lg.svg];
    drawPanel(t, parts, inst, pts, { px: PAD, left, right, top, bottom, xLabel: "hours, as reported", title: null, nameOwn: true });
    const fn = footnote(t, HOURS_FOOTER(pts), bottom + 70);
    parts.push(fn.svg);
    return doc(t, fn.bottom + 24, title, describeHours([{ inst, pts }]), parts);
  });
}

// Estimated FLOPs: the same frontier construction on the model's estimate (flops.mjs). The
// footnote counts the estimates that needed an architectural assumption.
const FLOPS_LEGEND = t => [
  { kind: "dot", color: t.series[0], label: "Variational bound" },
  { kind: "dot", color: t.series[1], label: "Projected" },
  { kind: "dot", color: t.series[2], label: "Extrapolated" },
  { kind: "ring", color: t.ink2, label: "Cannot hold a record" },
  { kind: "line", color: t.series[0], label: "Frontier" },
];
const FLOPS_MODEL = "Every mark is an estimate: iterations × samples × (connected configurations + sampler passes + 3) × forward-pass FLOPs, " +
  "from the counts the paper states; the optimizer's solve, symmetry projections and pre-training are not counted, and the model is good to an order of magnitude.";
function FLOPS_FOOTER(all) {
  const low = all.filter(p => p.cost.derived).length;
  const own = all.filter(p => p.r.computed_by === "qmbl").length;
  return FLOPS_MODEL + (low ? ` ${low} of these estimate${low === 1 ? "" : "s"} needed an assumption about the architecture.` : "") +
    (own ? ` Labels marked QMBL are QMBL's own reference runs (${own} row${own === 1 ? "" : "s"}).` : "");
}
const describeFlops = panels => panels.map(({ inst, pts }) => `${instLabel(inst)}: ${pts.map(p => `${shortLabel(p.r)} ${p.cost.value.toExponential(1)} FLOPs (estimated${p.cost.derived ? ", low confidence" : ""}) ${p.e.toFixed(6)}`).join(", ")}`).join("; ");

const flopsPanels = costFigure({
  name: "energy-vs-flops",
  title: "The best energies at each estimated cost in FLOPs, instance by instance",
  subtitle: panels => `Every published energy whose paper states enough to estimate its optimisation in floating-point operations, on the ${panels.length} instances with at least two such rows. ` +
    "The line is the frontier: the results nothing beats for less. Colour is the kind of number; filled marks can hold a record, hollow ones cannot.",
  costOf: estimatedFlopsOf, minRows: MIN_COSTED,
  xLabel: "FLOPs, estimated",
  legendItems: FLOPS_LEGEND,
  footer: panels => FLOPS_FOOTER(panels.flatMap(p => p.pts)),
  describe: describeFlops,
});

const FLOPS_DIR = "figures/flops";
fs.rmSync(FLOPS_DIR, { recursive: true, force: true });
fs.mkdirSync(FLOPS_DIR, { recursive: true });
for (const { inst, pts } of flopsPanels) {
  const name = flopsFigureName(inst);
  const title = `${instLabel(inst)}: the best energies at each estimated cost in FLOPs`;
  own.write(name, t => {
    const h = header(t, title, "Every energy on this instance whose paper states enough to estimate its optimisation in floating-point operations. " +
      "The line is the frontier: the results nothing beats for less.");
    const lg = legend(t, FLOPS_LEGEND(t), h.bottom + 34);
    const top = lg.bottom + 36, bottom = top + 300, left = PAD + 66, right = W - PAD - 8;
    const parts = [h.svg, lg.svg];
    drawPanel(t, parts, inst, pts, { px: PAD, left, right, top, bottom, xLabel: "FLOPs, estimated", title: null, nameOwn: true });
    const fn = footnote(t, FLOPS_FOOTER(pts), bottom + 70);
    parts.push(fn.svg);
    return doc(t, fn.bottom + 24, title, describeFlops([{ inst, pts }]), parts);
  });
}

const paramPanels = costFigure({
  name: "energy-vs-parameters",
  title: "The best energies at each parameter count, instance by instance",
  subtitle: panels => `Every published energy whose paper states the ansatz's parameter count, on the ${panels.length} instances with at least three such rows. ` +
    "The line is the frontier: the results no smaller ansatz beats. Colour is the kind of number; filled marks can hold a record, hollow ones cannot.",
  costOf: parametersOf, minRows: 3,
  xLabel: "variational parameters",
  legendItems: t => [
    { kind: "dot", color: t.series[0], label: "Variational bound" },
    { kind: "dot", color: t.series[1], label: "Projected" },
    { kind: "dot", color: t.series[2], label: "Extrapolated" },
    { kind: "ring", color: t.ink2, label: "Cannot hold a record" },
    { kind: "line", color: t.series[0], label: "Frontier" },
  ],
  footer: () => "Parameter counts as the papers print them; a count evaluated from a printed formula is marked medium confidence in the row. " +
    "Tensor-network bond dimensions and Monte Carlo sample counts are other costs and are not on this axis.",
  describe: panels => panels.map(({ inst, pts }) => `${instLabel(inst)}: ${pts.map(p => `${shortLabel(p.r)} ${p.cost.value} parameters ${p.e.toFixed(6)}`).join(", ")}`).join("; "),
});

console.log(`${OUT}/: ${written.length + own.written.length} files (${hoursPanels.length} per-instance cost figures, ${flopsPanels.length} per-instance FLOPs figures; energy vs compute: ${hoursPanels.length} instances, ${hoursPanels.reduce((a, p) => a + p.pts.length, 0)} rows; ` +
  `energy vs estimated FLOPs: ${flopsPanels.length} instances, ${flopsPanels.reduce((a, p) => a + p.pts.length, 0)} rows; ` +
  `energy vs parameters: ${paramPanels.length} instances, ${paramPanels.reduce((a, p) => a + p.pts.length, 0)} rows)`);
