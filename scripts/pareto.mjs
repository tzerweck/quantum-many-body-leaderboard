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

// Square marks for CPU core-hours, circles for everything else; a whisker under a derived
// cost. Same surface ring and filled/hollow convention as dot().
function mark(t, x, y, color, filled, unit, derived, href) {
  const out = [];
  if (unit === "cpu") {
    out.push(`<rect x="${n(x - 6.5)}" y="${n(y - 6.5)}" width="13" height="13" rx="2" fill="${t.surface}"/>`);
    out.push(filled
      ? `<rect x="${n(x - 4.5)}" y="${n(y - 4.5)}" width="9" height="9" rx="1.5" fill="${color}"/>`
      : `<rect x="${n(x - 4)}" y="${n(y - 4)}" width="8" height="8" rx="1.5" fill="${t.surface}" stroke="${color}" stroke-width="2"/>`);
  } else out.push(dot(t, x, y, color, filled));
  if (derived) out.push(`<path d="M${n(x - 7)} ${n(y + 9)}H${n(x + 7)}" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>`);
  return linked(href, out.join(""));
}

// One instance's energies against their cost, into the box given: the energy axis is
// linear and per site, the cost axis logarithmic, the record drawn as a line whether or
// not it is costed, the frontier as a staircase with its points named.
function drawPanel(t, parts, inst, pts, { px, left, right, top, bottom, xLabel, title }) {
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
    const es = pts.map(p => p.e).concat(recE == null ? [] : [recE]);
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
    if (recE != null) {
      parts.push(hline(left, right, Y(recE), t.ink2));
      // Named below its line, where nothing but a projection or extrapolation can sit.
      parts.push(text(left + 4, Y(recE) + 13, `${rec.bound_type === "exact" ? boundLabel(rec) : "record"}: ${shortLabel(rec)}`, { size: 10.5, fill: t.ink, weight: 600 }));
    }
    if (front.length > 1) {
      let d = `M${n(X(front[0].cost.value))} ${n(Y(front[0].e))}`;
      for (const p of front.slice(1)) d += `H${n(X(p.cost.value))}V${n(Y(p.e))}`;
      parts.push(`<path d="${d}" fill="none" stroke="${t.series[0]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.7"/>`);
    }
    for (const p of [...pts].sort((a, b) => a.eligible - b.eligible))
      parts.push(mark(t, X(p.cost.value), Y(p.e), t.series[BOUNDS[p.r.bound_type]], p.eligible, p.cost.unit, p.cost.derived, rowHref(p.inst, p.r)));
    // Frontier points are named; the label goes right of the mark, or left at the edge,
    // and is nudged down where it would sit on the previous one.
    const labels = front.filter(p => p.r !== rec).map(p => {
      const s = shortLabel(p.r), w = textWidth(s, 10.5), x = X(p.cost.value), y = Y(p.e);
      const rightSide = x + 10 + w <= right;
      return { s, w, x: rightSide ? x + 10 : x - 10, anchor: rightSide ? "start" : "end", y: y + 4 };
    }).sort((a, b) => a.y - b.y);
    for (let a = 1; a < labels.length; a++) if (labels[a].y - labels[a - 1].y < 12) labels[a].y = labels[a - 1].y + 12;
    for (const l of labels) parts.push(text(l.x, l.y, l.s, { size: 10.5, fill: t.ink2, anchor: l.anchor }));
    parts.push(text((left + right) / 2, bottom + 32, xLabel, { size: 10.5, fill: t.ink2, anchor: "middle" }));
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
    const y = top0 + (Math.ceil(panels.length / cols) - 1) * pitch + plotH + 56;
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
// Cut to the marks and the whisker (Tristan, 2026-09-18): the no-conversion rule and the
// bound kinds are said in the page text and the legend.
function HOURS_FOOTER(all) {
  const cpu = all.filter(p => p.cost.unit === "cpu").length, der = all.filter(p => p.cost.derived).length;
  const rows = k => `${k} row${k === 1 ? "" : "s"}`;
  return (cpu ? `Circles are GPU-hours, squares CPU core-hours (${rows(cpu)}).` : "Every mark is GPU-hours.") +
    (der ? ` A whisker under a mark means the hours are devices × wall-clock, multiplied here (${rows(der)}).` : "");
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
  footer: panels => HOURS_FOOTER(panels.flatMap(p => p.pts)) + " The horizontal line is the instance's record, costed or not.",
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
      "The line is the frontier: the results nothing beats for less; the horizontal line is the record, costed or not.");
    const lg = legend(t, HOURS_LEGEND(t), h.bottom + 34);
    const top = lg.bottom + 36, bottom = top + 300, left = PAD + 66, right = W - PAD - 8;
    const parts = [h.svg, lg.svg];
    drawPanel(t, parts, inst, pts, { px: PAD, left, right, top, bottom, xLabel: "hours, as reported", title: null });
    const fn = footnote(t, HOURS_FOOTER(pts), bottom + 56);
    parts.push(fn.svg);
    return doc(t, fn.bottom + 24, title, describeHours([{ inst, pts }]), parts);
  });
}

// Estimated FLOPs: the same frontier construction on the model's estimate (flops.mjs). The
// whisker means an architectural assumption was needed, not a derivation from stated hours.
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
  return FLOPS_MODEL + (low ? ` A whisker under a mark means an assumption about the architecture was needed (${low} row${low === 1 ? "" : "s"}).` : "");
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
  footer: panels => FLOPS_FOOTER(panels.flatMap(p => p.pts)) + " The horizontal line is the instance's record, costed or not.",
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
      "The line is the frontier: the results nothing beats for less; the horizontal line is the record, costed or not.");
    const lg = legend(t, FLOPS_LEGEND(t), h.bottom + 34);
    const top = lg.bottom + 36, bottom = top + 300, left = PAD + 66, right = W - PAD - 8;
    const parts = [h.svg, lg.svg];
    drawPanel(t, parts, inst, pts, { px: PAD, left, right, top, bottom, xLabel: "FLOPs, estimated", title: null });
    const fn = footnote(t, FLOPS_FOOTER(pts), bottom + 56);
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
    "Tensor-network bond dimensions and Monte Carlo sample counts are other costs and are not on this axis. The horizontal line is the instance's record, costed or not.",
  describe: panels => panels.map(({ inst, pts }) => `${instLabel(inst)}: ${pts.map(p => `${shortLabel(p.r)} ${p.cost.value} parameters ${p.e.toFixed(6)}`).join(", ")}`).join("; "),
});

console.log(`${OUT}/: ${written.length + own.written.length} files (${hoursPanels.length} per-instance cost figures, ${flopsPanels.length} per-instance FLOPs figures; energy vs compute: ${hoursPanels.length} instances, ${hoursPanels.reduce((a, p) => a + p.pts.length, 0)} rows; ` +
  `energy vs estimated FLOPs: ${flopsPanels.length} instances, ${flopsPanels.reduce((a, p) => a + p.pts.length, 0)} rows; ` +
  `energy vs parameters: ${paramPanels.length} instances, ${paramPanels.reduce((a, p) => a + p.pts.length, 0)} rows)`);
