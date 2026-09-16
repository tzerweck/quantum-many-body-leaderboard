// Generate figures/size-vs-accuracy*.svg: how far each published energy sits from its
// instance's reference, against system size. Compute is one cost of a result; the other
// question the field asks is how a method's accuracy holds up as N grows, and n_sites is
// on every instance, so this view needs nothing the rows do not already carry.
//
// The reference is the exact energy wherever an instance has one (Tristan, 2026-09-16):
// there the gap is a measurement, not a comparison. The two exact-referenced figures use
// only such instances. The ladders fall back to the record where no exact row exists, and
// say so per size; there the record itself has a gap of zero and is drawn in a band of
// its own, because a log axis cannot place it and a floor would make it look like an
// outlier. None of the three draws a V-score, a variance or a distance-to-record for the
// record itself, so nothing here says how well converged a standing record is - that is
// the beatable-records question, which stays off the site.
import { recordEligible, perSiteDivisor } from "./units.mjs";
import { collect, recordOf, exactRecordOf } from "./summary.mjs";
import { FAMILIES, family } from "./views.mjs";
import { W, PAD, n, text, hline, dot, legend, header, footnote, doc, textWidth, writer } from "./chart.mjs";

const OUT = "figures";
const instances = collect();
const { write, written } = writer(OUT);

const BOUNDS = { variational: 0, projected: 1, extrapolated: 2 };
const FLOOR = 1e-8; // relative gaps below this are drawn at the floor, and counted

// The reference an instance's rows are measured against, and what kind it is.
function referenceOf(inst) {
  const exact = exactRecordOf(inst);
  if (exact) return { row: exact, kind: "exact" };
  const rec = recordOf(inst);
  return rec ? { row: rec, kind: "record" } : null;
}

// Every row that is a result rather than the answer: a bound or an extrapolation,
// unflagged, with a stated bound type. `gap` is relative to the reference energy;
// extrapolations and projections may land below an exact reference, and the absolute
// value is what the axis shows, so the colour has to say which kind of row it is.
function points(inst, ref) {
  return inst.rows
    .filter(r => r.bound_type in BOUNDS && !r.defect && r !== ref.row)
    .map(r => ({ r, inst, fam: family(r.method), eligible: recordEligible(r),
      gap: Math.abs(r.energy - ref.row.energy) / Math.abs(ref.row.energy) }));
}

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const pow10 = k => "10" + String(k).split("").map(c => SUP[c]).join("");
const log = Math.log10;

// A log-log plot area: axes, grid, and the two scales. `ny` is the number of decades on y.
function logPlot(t, parts, { left, right, top, bottom, x0, x1, y0, y1, xTicks, xLabel, yLabel }) {
  const X = v => left + ((log(v) - log(x0)) / (log(x1) - log(x0))) * (right - left);
  const Y = v => bottom - ((log(Math.max(v, y0)) - log(y0)) / (log(y1) - log(y0))) * (bottom - top);
  for (let k = Math.ceil(log(y0)); k <= Math.floor(log(y1)); k++) {
    const v = 10 ** k;
    parts.push(hline(left, right, Y(v), t.grid));
    parts.push(text(left - 8, Y(v) + 4, pow10(k), { size: 11, fill: t.muted, anchor: "end", nums: true }));
  }
  for (const v of xTicks) parts.push(text(X(v), bottom + 18, String(v), { size: 11, fill: t.muted, anchor: "middle", nums: true }));
  if (xLabel) parts.push(text((left + right) / 2, bottom + 38, xLabel, { size: 12, fill: t.ink2, anchor: "middle" }));
  if (yLabel) parts.push(`<text transform="translate(${n(left - 46)} ${n((top + bottom) / 2)}) rotate(-90)" font-size="12" fill="${t.ink2}" text-anchor="middle">${yLabel}</text>`);
  return { X, Y };
}

// The best gap at each size among a set of points, as a step line from size to size.
function frontier(pts, X, Y, color) {
  const bySize = Map.groupBy(pts, p => p.inst.n_sites);
  const steps = [...bySize].map(([N, ps]) => [N, Math.min(...ps.map(p => p.gap))]).sort((a, b) => a[0] - b[0]);
  if (steps.length < 2) return "";
  const d = steps.map(([N, g], k) => `${k ? "L" : "M"}${n(X(N))} ${n(Y(g))}`).join("");
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>`;
}

const exactRef = instances.map(i => [i, referenceOf(i)]).filter(([, ref]) => ref?.kind === "exact");
const all = exactRef.flatMap(([i, ref]) => points(i, ref));
const NS = all.map(p => p.inst.n_sites);
const X0 = 8, X1 = Math.max(...NS) * 1.4;
const Y0 = FLOOR, Y1 = 1;
const XT = [10, 30, 100, 300, 1000].filter(v => v <= X1);
const floored = all.filter(p => p.gap < FLOOR).length;

// ------------------------------------------------------ 1. every row against an exact energy
write("size-vs-accuracy", t => {
  const h = header(t, "How far published energies sit from the exact answer, by system size",
    `${all.length} energies on the ${exactRef.length} instances that have an exact ground-state energy, ` +
    "each as its relative distance from that energy. Colour is the kind of number; filled marks can hold a record, hollow ones cannot.");
  const lg = legend(t, [
    { kind: "dot", color: t.series[0], label: "Variational bound" },
    { kind: "dot", color: t.series[1], label: "Projected (fixed-node)" },
    { kind: "dot", color: t.series[2], label: "Extrapolated" },
    { kind: "ring", color: t.ink2, label: "Listed, cannot hold a record" },
  ], h.bottom + 34);
  const top = lg.bottom + 28, bottom = top + 360, left = PAD + 62, right = W - PAD - 8;
  const parts = [h.svg, lg.svg];
  const { X, Y } = logPlot(t, parts, { left, right, top, bottom, x0: X0, x1: X1, y0: Y0, y1: Y1, xTicks: XT,
    xLabel: "sites", yLabel: "relative distance from the exact energy" });
  // Hollow first, then filled; within each, extrapolated and projected under variational.
  const order = [...all].sort((a, b) => (a.eligible - b.eligible) || (BOUNDS[b.r.bound_type] - BOUNDS[a.r.bound_type]));
  for (const p of order) parts.push(dot(t, X(p.inst.n_sites), Y(p.gap), t.series[BOUNDS[p.r.bound_type]], p.eligible));
  const fn = footnote(t, `Distance is |E − E_exact| / |E_exact|; ${floored} rows closer than ${pow10(log(FLOOR))} sit on the bottom line. ` +
    "No line is drawn across sizes: the instances at one size are different Hamiltonians, and a frontier across them would compare a Hubbard " +
    "energy with a Heisenberg one. Exact references are exact diagonalization or sign-problem-free QMC; flagged rows are not shown.", bottom + 58);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, "How far published energies sit from the exact answer, by system size",
    `Relative distance from the exact ground-state energy versus number of sites for ${all.length} published energies on ${exactRef.length} exactly solved instances.`, parts);
});

// ------------------------------------------------------------- 2. the same, by method family
// Ten small multiples on shared axes: the family's rows in colour over every row in grey,
// with the family's best gap at each size as a line. Same caveat as above about the line:
// it joins different Hamiltonians, so it shows the family's reach, not one problem.
write("size-vs-accuracy-by-family", t => {
  const names = [...FAMILIES.map(f => f[0]), "other"].filter(f => all.some(p => p.fam === f));
  const cols = 2, rows = Math.ceil(names.length / cols);
  const h = header(t, "The same distances, one panel per method family",
    "Each panel colours one family's energies over all the others in grey and joins the family's best distance at each size. " +
    "A method that only ever ran at one size is a lone mark.");
  const panelW = (W - 2 * PAD - 40) / cols, plotH = 150, pitch = plotH + 78;
  const top0 = h.bottom + 40;
  const parts = [h.svg];
  names.forEach((name, k) => {
    const col = k % cols, row = Math.floor(k / cols);
    const px = PAD + col * (panelW + 40), left = px + 58, right = px + panelW - 4;
    const top = top0 + row * pitch, bottom = top + plotH;
    const mine = all.filter(p => p.fam === name);
    parts.push(text(left, top - 12, `${name} (${mine.length})`, { size: 13, fill: t.ink, weight: 600 }));
    const { X, Y } = logPlot(t, parts, { left, right, top, bottom, x0: X0, x1: X1, y0: Y0, y1: Y1, xTicks: XT,
      xLabel: row === rows - 1 ? "sites" : null, yLabel: null });
    for (const p of all) if (p.fam !== name)
      parts.push(`<circle cx="${n(X(p.inst.n_sites))}" cy="${n(Y(p.gap))}" r="2.5" fill="${t.recessive[0]}"/>`);
    parts.push(frontier(mine, X, Y, t.series[0]));
    for (const p of [...mine].sort((a, b) => a.eligible - b.eligible)) parts.push(dot(t, X(p.inst.n_sites), Y(p.gap), t.series[0], p.eligible));
  });
  const y = top0 + (rows - 1) * pitch + plotH + 62;
  const fn = footnote(t, "Families are assigned from the method string (views.mjs), first match wins; 'other' is what none of the patterns name. " +
    "Filled marks can hold a record, hollow ones cannot. Axes as in the figure above.", y);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, "Distance from the exact energy by system size, one panel per method family",
    names.map(f => `${f}: ${all.filter(p => p.fam === f).length} energies`).join("; "), parts);
});

// ---------------------------------------------------------------- 3. the instance ladders
// Same Hamiltonian at growing sizes. Where a size has no exact energy the reference is the
// record, and the size is marked so below the axis; the record holder itself sits in the
// band at the bottom. One line per method family through its best row at each size.
const LADDERS = [
  ["J1-J2 square, J2 = 0.5, periodic", i => i.model === "J1J2" && i.lattice === "square" && i.boundary === "P" && i.params.J2 === 0.5],
  ["Heisenberg square, periodic", i => i.model === "Heisenberg" && i.lattice === "square" && i.boundary === "P"],
  ["Heisenberg triangular, periodic", i => i.model === "Heisenberg" && i.lattice === "triangular" && i.boundary === "P"],
  ["Heisenberg kagome, periodic", i => i.model === "Heisenberg" && i.lattice.startsWith("kagome") && i.boundary === "P"],
  ["Heisenberg pyrochlore, periodic", i => i.model === "Heisenberg" && i.lattice.startsWith("pyrochlore")],
  ["Hubbard U = 8, n = 0.875, periodic", i => i.model === "Hubbard" && i.boundary === "P" && i.params.U === 8 && i.params.Nf === i.n_sites * 0.4375],
];

write("size-vs-accuracy-ladders", t => {
  const cols = 2, plotH = 190, pitch = plotH + 96, panelW = (W - 2 * PAD - 40) / cols;
  const h = header(t, "Accuracy as the same Hamiltonian grows",
    "Six families of instances that differ only in size. Distance is from the exact energy where one exists (sizes in grey), " +
    "otherwise from the standing record (sizes in orange), whose holder then sits in the band under the axis. One line per method family, " +
    "through its best energy at each size; a family present at one size only is a lone mark.");
  const lg = legend(t, [
    { kind: "line", color: t.series[0], label: "Best at each size" },
    { kind: "line", color: t.recessive[1], label: "One method family" },
    { kind: "dot", color: t.ink2, label: "Can hold a record" },
    { kind: "ring", color: t.ink2, label: "Cannot" },
  ], h.bottom + 34);
  const top0 = lg.bottom + 40;
  const parts = [h.svg, lg.svg];
  const descs = [];
  LADDERS.forEach(([title, pick], k) => {
    const col = k % cols, row = Math.floor(k / cols);
    const px = PAD + col * (panelW + 40), left = px + 58, right = px + panelW - 4;
    const top = top0 + row * pitch, bottom = top + plotH, band = bottom + 24;
    const members = instances.filter(pick).map(i => [i, referenceOf(i)]).filter(([, ref]) => ref).sort((a, b) => a[0].n_sites - b[0].n_sites);
    const sizes = [...new Set(members.map(([i]) => i.n_sites))];
    const pts = members.flatMap(([i, ref]) => points(i, ref));
    const holders = members.filter(([, ref]) => ref.kind === "record").map(([i, ref]) => ({ inst: i, r: ref.row, fam: family(ref.row.method) }));
    parts.push(text(left, top - 12, `${title} (${pts.length + holders.length} energies, ${sizes.length} sizes)`, { size: 13, fill: t.ink, weight: 600 }));
    const x0 = sizes[0] / 1.5, x1 = sizes.at(-1) * 1.5;
    const { X, Y } = logPlot(t, parts, { left, right, top, bottom, x0, x1, y0: Y0, y1: Y1, xTicks: [], xLabel: null, yLabel: null });
    // One tick per size; the label is coloured by what that size is measured against, and
    // dropped where it would run into the previous one (the Heisenberg square has 29 sizes).
    let lastEnd = -Infinity;
    for (const N of sizes) {
      const kind = members.find(([i]) => i.n_sites === N)[1].kind, x = X(N), w = textWidth(String(N), 11);
      parts.push(`<path d="M${n(x)} ${n(bottom)}v4" stroke="${t.grid}" stroke-width="1"/>`);
      if (x - w / 2 < lastEnd + 6) continue;
      parts.push(text(x, bottom + 18, String(N), { size: 11, fill: kind === "exact" ? t.muted : t.series[1], anchor: "middle", nums: true }));
      lastEnd = x + w / 2;
    }
    // The record holders' band, below the axis: gap zero by construction.
    if (holders.length) {
      parts.push(hline(left, right, band + 18, t.grid));
      parts.push(text(left - 8, band + 22, "holds the record", { size: 9.5, fill: t.muted, anchor: "end" }));
      for (const hd of holders) parts.push(dot(t, X(hd.inst.n_sites), band + 18, t.ink2, true));
    }
    // One line per family through its best row at each size; the overall best on top.
    const fams = Map.groupBy(pts, p => p.fam);
    const ends = [];
    for (const [fam, ps] of fams) {
      const line = frontier(ps, X, Y, t.recessive[1]);
      if (line) {
        parts.push(line);
        const last = [...Map.groupBy(ps, p => p.inst.n_sites)].map(([N, q]) => [N, Math.min(...q.map(p => p.gap))]).sort((a, b) => b[0] - a[0])[0];
        ends.push({ fam, x: X(last[0]) + 9, y: Y(last[1]) + 4 });
      }
    }
    parts.push(frontier(pts, X, Y, t.series[0]));
    for (const p of [...pts].sort((a, b) => a.eligible - b.eligible)) parts.push(dot(t, X(p.inst.n_sites), Y(p.gap), t.ink2, p.eligible));
    // Family names at the right end of each line, nudged apart where two would collide.
    ends.sort((a, b) => a.y - b.y);
    for (let a = 1; a < ends.length; a++) if (ends[a].y - ends[a - 1].y < 13) ends[a].y = ends[a - 1].y + 13;
    for (const e of ends) {
      const w = textWidth(e.fam, 10.5);
      const x = e.x + w > right + 30 ? e.x - 18 - w : e.x;
      parts.push(text(x, e.y, e.fam, { size: 10.5, fill: t.ink2 }));
    }
    descs.push(`${title}: ${pts.length} energies at sizes ${sizes.join(", ")}`);
  });
  const y = top0 + Math.ceil(LADDERS.length / cols) * pitch - 22;
  const fn = footnote(t, "Sizes are numbers of sites. A family's line joins its lowest distance at each size, whichever paper set it, so a line is a family's " +
    "reach rather than one calculation. Where the reference is the record, the distances say how far behind the others are and nothing about the record itself.", y);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, "Accuracy as the same Hamiltonian grows: six instance ladders", descs.join("; "), parts);
});

console.log(`${OUT}/: ${written.length} files (size vs accuracy: ${all.length} exact-referenced energies on ${exactRef.length} instances, ${floored} at the floor)`);
