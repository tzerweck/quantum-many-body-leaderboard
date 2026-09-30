// Generate figures/cost-vs-size-ladder*.svg and figures/cost-vs-size-frontier*.svg: what a
// result costs as the lattice grows, on J1-J2 at J2 = 0.5 on the periodic L x L squares, the
// Hamiltonian with QMBL's own size ladder and the most costed published rows (Tristan,
// 2026-09-24/29: the frontier per instance, then its cost across the sizes).
//
// - The ladder: QMBL's own runs under one protocol (checks/cost/README.md, amendment v1.5), a
//   dot per run: the four networks' GPU-hours on one H100 NVL, DMRG's core-hours per rung on 8
//   CPU cores. Colour is the ansatz, a square is a CPU core-hour; the units are never converted.
// - The frontier: on each size, the results nothing beats for less on that lattice, by the
//   estimated FLOPs of flops.mjs (the construction of pareto.mjs's frontier, instance by
//   instance), placed at their cost against N. Energies of different sizes are not compared;
//   each lattice's own figure shows its frontier with the energies.
//
// Every result is a dot and only a dot (no line joins the sizes), each links to its row, and
// QMBL's runs are named "QMBL".
import fs from "node:fs";
import { recordEligible, exactEligible, perSiteDivisor } from "./units.mjs";
import { collect } from "./summary.mjs";
import { hoursOf } from "./cost.mjs";
import { estimatedFlopsOf } from "./flops.mjs";
import { W, PAD, n, text, hline, dot, legend, header, footnote, doc, writer, log, pow10, shortLabel, rowHref, linked } from "./chart.mjs";
import { layoutLabels } from "./labels.mjs";

const OUT = "figures";
const { write, written } = writer(OUT);
const BOUNDS = { variational: 0, projected: 1, extrapolated: 2, exact: 3 };

// J1-J2 at J2 = 0.5 on the periodic L x L squares (not the tilted 40- and 50-site clusters).
const SQUARES = collect().filter(i => i.model === "J1J2" && i.lattice === "square" && i.boundary === "P" && i.params.J2 === 0.5 &&
  Number.isInteger(Math.sqrt(i.n_sites))).sort((a, b) => a.n_sites - b.n_sites);
const side = N => Math.round(Math.sqrt(N));

// What the ladder runs, as ladder.sh (h100/) and the DMRG jobs of the Slurm submit script
// state it: the footnote names what has not landed yet.
const LADDER = { nqs: [4, 6, 8, 10, 12, 14, 16], dmrg: [6, 8, 10, 12], chi: [500, 1000, 2000] };
const ANSATZ = [["rbm", "RBM"], ["rbmsymm", "symmetric RBM"], ["gcnn", "GCNN"], ["vit", "ViT"]];
const ansatzOf = r => (r.method === "RBM" ? (/symmetric: translations/.test(r.method_detail || "") ? "rbmsymm" : "rbm") : r.method === "GCNN" ? "gcnn" : r.method === "ViT" ? "vit" : null);

// Square marks for CPU core-hours, circles for GPU-hours, as in pareto.mjs.
function mark(t, x, y, color, unit, href) {
  if (unit !== "cpu") return linked(href, dot(t, x, y, color, true));
  return linked(href, `<rect x="${n(x - 6.5)}" y="${n(y - 6.5)}" width="13" height="13" rx="2" fill="${t.surface}"/>` +
    `<rect x="${n(x - 4.5)}" y="${n(y - 4.5)}" width="9" height="9" rx="1.5" fill="${color}"/>`);
}

// A log axis over the sizes drawn, a tick per size present, labelled L x L.
function sizeAxis(t, parts, sizes, left, right, bottom) {
  const lo = log(sizes[0]) - 0.07, hi = log(sizes.at(-1)) + 0.07;
  const X = N => left + ((log(N) - lo) / (hi - lo)) * (right - left);
  for (const N of sizes) parts.push(text(X(N), bottom + 16, `${side(N)}×${side(N)}`, { size: 10, fill: t.muted, anchor: "middle", nums: true }));
  parts.push(text((left + right) / 2, bottom + 34, "lattice: periodic L × L, N = L² sites", { size: 10.5, fill: t.ink2, anchor: "middle" }));
  // The size a mark drawn `dx` px beside N's tick would stand for: marks of one size dodged apart
  // are placed, and named, through the same scale.
  X.shift = (N, dx) => N * 10 ** ((dx * (hi - lo)) / (right - left));
  return X;
}
// A log cost axis a little beyond the data, a gridline and label per decade.
function costAxis(t, parts, values, left, right, top, bottom, unitLabel) {
  const k0 = Math.floor(log(Math.min(...values)) - 0.15), k1 = Math.ceil(log(Math.max(...values)) + 0.15);
  const Y = v => bottom - ((log(v) - k0) / (k1 - k0)) * (bottom - top);
  for (let k = k0; k <= k1; k++) {
    parts.push(hline(left, right, Y(10 ** k), t.grid));
    parts.push(text(left - 6, Y(10 ** k) + 4, pow10(k), { size: 10, fill: t.muted, anchor: "end", nums: true }));
  }
  parts.push(text(left, top - 12, unitLabel, { size: 9.5, fill: t.muted }));
  return Y;
}
const drawNames = (t, parts, L) => {
  for (const l of L.leaders) parts.push(`<path d="M${n(l.x)} ${n(l.y0)}V${n(l.y1)}" stroke="${t.muted}" stroke-width="1"/>`);
  for (const l of L.lines) parts.push(linked(rowHref(l.rows[0].inst, l.rows[0].r), text(l.x, l.y, l.s, { size: 10.5, fill: t.ink2, anchor: l.anchor })));
  for (const k of L.keyed) parts.push(linked(rowHref(k.p.inst, k.p.r), text(k.x, k.y, k.num, { size: 9, fill: t.ink2, anchor: k.anchor, weight: 600 })));
};

// ------------------------------------------------------------------------------ the ladder
const ladder = SQUARES.flatMap(inst => inst.rows.filter(r => r.computed_by === "qmbl").flatMap(r => {
  const cost = hoursOf(r.compute);
  if (!cost) return [];
  if (r.method === "DMRG" && LADDER.dmrg.includes(side(inst.n_sites))) return [{ r, inst, cost, key: `dmrg-${r.compute.bond_dimension}` }];
  if (/H100 size ladder/.test(r.method_detail || "") && ansatzOf(r)) return [{ r, inst, cost, key: ansatzOf(r) }];
  return [];
}));
// A run that finished but whose final evaluation did not equilibrate is no row (checks/cost/README.md,
// R-hat below 1.05); its results file says so, and the footnote says it rather than "still running".
const resultOf = name => { try { return JSON.parse(fs.readFileSync(`checks/cost/results/${name}.json`, "utf8")); } catch { return null; } };
const unequilibrated = [], missing = [
  ...ANSATZ.flatMap(([key, name]) => LADDER.nqs.filter(L => !ladder.some(p => p.key === key && side(p.inst.n_sites) === L)).flatMap(L => {
    const res = resultOf(`h100-${key}-j1j2-${L * L}`);
    if (res && !(res.r_hat < 1.05)) { unequilibrated.push(`${name} on ${L}×${L} (R-hat ${res.r_hat.toFixed(2)})`); return []; }
    return [`${name} on ${L}×${L}`];
  })),
  ...LADDER.dmrg.filter(L => LADDER.chi.some(c => !ladder.some(p => p.key === `dmrg-${c}` && side(p.inst.n_sites) === L))).map(L => `DMRG on ${L}×${L}`),
];
// The four ansätze of one size cost alike on the small lattices, so they are drawn side by side,
// 10 px apart, in the legend's order; DMRG, far above them, stays on the tick.
const DODGE = { rbm: -15, rbmsymm: -5, gcnn: 5, vit: 15 };
const ladderColour = (t, key) => (key.startsWith("dmrg") ? t.ink2 : t.series[ANSATZ.findIndex(([k]) => k === key)]);
const nameOfLadder = p => (p.key.startsWith("dmrg") ? `DMRG χ = ${p.key.slice(5)} (QMBL)` : `${ANSATZ.find(([k]) => k === p.key)[1]} (QMBL)`);

write("cost-vs-size-ladder", t => {
  const title = "J1-J2 at J2 = 0.5: what QMBL's own runs cost as the lattice grows";
  const h = header(t, title, "One protocol for every size (the same sampler, samples, 2000 steps and final evaluation): each ansatz on one NVIDIA H100 NVL, DMRG on 8 cores of an AMD EPYC 7763 in rungs of bond dimension. A dot per run.");
  const lg = legend(t, [...ANSATZ.map(([key, name]) => ({ kind: "dot", color: ladderColour(t, key), label: name })),
    { kind: "square", color: t.ink2, label: "DMRG, bond dimension χ = 500, 1000, 2000" }], h.bottom + 34);
  const top = lg.bottom + 44, bottom = top + 340, left = PAD + 52, right = W - PAD - 150;
  const parts = [h.svg, lg.svg];
  const sizes = [...new Set(ladder.map(p => p.inst.n_sites))].sort((a, b) => a - b);
  const X = sizeAxis(t, parts, sizes, left, right, bottom);
  const Y = costAxis(t, parts, ladder.map(p => p.cost.value), left, right, top, bottom, "hours: GPU-hours (circles), CPU core-hours (squares)");
  const at = p => X.shift(p.inst.n_sites, DODGE[p.key] ?? 0);
  for (const p of ladder) parts.push(mark(t, X(at(p)), Y(p.cost.value), ladderColour(t, p.key), p.cost.unit, rowHref(p.inst, p.r)));
  // Each series named at its largest size, room to the right of the plot for it.
  const ends = [...Map.groupBy(ladder, p => p.key).values()].map(ps => ps.reduce((a, b) => (b.inst.n_sites > a.inst.n_sites ? b : a)));
  const pts = ladder.map(p => ({ ...p, cost: { value: at(p) }, e: p.cost.value }));
  const named = pts.filter(p => ends.some(e => e.r === p.r));
  drawNames(t, parts, layoutLabels({ pts, named, X, Y, front: [], left, right: W - PAD, top, bottom, nameOf: nameOfLadder, nameAll: true }));
  const fn = footnote(t, "GPU-hours are wall-clock from process start to the end of the final evaluation, JIT compilation and sampling included; " +
    "a DMRG rung's core-hours are counted from process start, so each includes the rungs below it. The two units are never converted into each other. " +
    "Hover a mark for its energy." + (unequilibrated.length ? ` Not drawn: ${unequilibrated.join(", ")}, which finished but whose final evaluation did not equilibrate, so under the protocol it is no row.` : "") +
    (missing.length ? ` Still running: ${missing.join(", ")}.` : ""), bottom + 58);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, title, ladder.map(p => `${nameOfLadder(p)} ${side(p.inst.n_sites)}x${side(p.inst.n_sites)} ${p.cost.value.toFixed(3)} ${p.cost.unit === "cpu" ? "CPU core-h" : "GPU-h"}`).join(", "), parts);
});

// ---------------------------------------------------------------------------- the frontier
// On each lattice, the rows nothing beats for less (pareto.mjs): sorted by estimated FLOPs, a
// row that could hold a record is on the frontier when its energy is below every cheaper one.
const frontier = SQUARES.flatMap(inst => {
  const f = perSiteDivisor(inst);
  const pts = inst.rows.filter(r => r.bound_type in BOUNDS && !r.defect).flatMap(r => {
    const cost = estimatedFlopsOf(r.compute, r, inst);
    if (!cost || !(r.bound_type !== "exact" || exactEligible(r))) return [];
    return [{ r, inst, cost, e: r.energy / f, eligible: r.bound_type === "exact" ? exactEligible(r) : recordEligible(r) }];
  });
  let best = Infinity;
  const front = [];
  for (const p of pts.sort((a, b) => a.cost.value - b.cost.value || a.e - b.e)) if (p.eligible && p.e < best) { best = p.e; front.push(p); }
  return front;
});
const markName = r => shortLabel({ ...r, method_detail: undefined, compute: undefined, bound_type: "variational", defect: undefined });

write("cost-vs-size-frontier", t => {
  const title = "J1-J2 at J2 = 0.5: what the best results on each lattice cost, in estimated FLOPs";
  const h = header(t, title, "On each size, the results whose cost can be estimated that nothing beats for less on that lattice: sorted by estimated cost, each is lower in energy than every cheaper one. " +
    "Energies of different sizes are not compared; each lattice's own figure shows its frontier with the energies.");
  const top = h.bottom + 56, bottom = top + 440, left = PAD + 52, right = W - PAD - 8;
  const parts = [h.svg];
  const sizes = [...new Set(frontier.map(p => p.inst.n_sites))].sort((a, b) => a - b);
  const X = sizeAxis(t, parts, sizes, left, right, bottom);
  const Y = costAxis(t, parts, frontier.map(p => p.cost.value), left, right, top, bottom, "FLOPs, estimated");
  for (const p of frontier) parts.push(mark(t, X(p.inst.n_sites), Y(p.cost.value), t.series[0], "gpu", rowHref(p.inst, p.r)));
  const pts = frontier.map(p => ({ ...p, cost: { value: p.inst.n_sites }, e: p.cost.value }));
  drawNames(t, parts, layoutLabels({ pts, named: pts, X, Y, front: [], left, right, top, bottom, nameOf: p => markName(p.r), nameAll: true }));
  const own = frontier.filter(p => p.r.computed_by === "qmbl").length;
  const fn = footnote(t, "Every mark is an estimate, good to an order of magnitude (DATA.md, How a FLOP count is estimated), and a variational bound. " +
    `Names marked QMBL are QMBL's own reference runs (${own} of ${frontier.length}). A lattice's record is drawn only where its cost can be estimated. Hover a mark for its energy and source.`, bottom + 58);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, title, frontier.map(p => `${side(p.inst.n_sites)}x${side(p.inst.n_sites)}: ${markName(p.r)} ${p.cost.value.toExponential(1)} FLOPs`).join(", "), parts);
});

console.log(`${OUT}/: ${written.length} files (cost against size: ladder ${ladder.length} runs on ${new Set(ladder.map(p => p.inst.n_sites)).size} sizes` +
  `${unequilibrated.length ? `, not rows ${unequilibrated.join(", ")}` : ""}` +
  `${missing.length ? `, still running ${missing.join(", ")}` : ""}; frontier ${frontier.length} rows on ${new Set(frontier.map(p => p.inst.n_sites)).size} sizes)`);
