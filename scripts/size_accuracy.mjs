// Generate figures/size-vs-accuracy*.svg: how far each published energy sits from its
// instance's reference, against system size. Compute is one cost of a result; the other
// question the field asks is how a method's accuracy holds up as N grows, and n_sites is
// on every instance, so this view needs nothing the rows do not already carry.
//
// Size runs along x and accuracy up y (Tristan, 2026-09-16): the distance axis is a log
// scale turned upside down, 10^0 at the bottom and 10^-8 at the top, so a better energy
// is higher on the page and the reference itself - distance zero, off any log scale -
// is the line or band above the plot.
//
// The question every figure here asks is which published results are the best (Tristan,
// 2026-09-16); the relative gap is only the mechanic that lets Hamiltonians of different
// energy scales share one axis. It is taken against the exact energy wherever an instance
// has one. The two exact-referenced figures use
// only such instances. The per-Hamiltonian figures (figures/size/, one per model, lattice
// and boundary, a panel per ladder of sizes, see ladders.mjs) fall back to the record where
// no exact row exists, and say so per size; there the record holder sits in the band at
// the top. A row below the energy it is measured against is a triangle there, as the log
// scale shows only the size of the distance.
//
// The two exact-referenced figures draw an "exact" line above the 10^-8 gridline instead
// (Tristan, 2026-09-17), with sign-problem-free QMC counted as exact. A row closer than
// 10^-8 sits on that line, above or below. A row below the exact energy within twice the
// joint error bar is placed by the size of its gap, since inside the error bar the sign
// says nothing. A row further below than that has no place on either axis, so it is not
// drawn and the footnote counts it. None of these draws a V-score, a variance or a
// distance-to-record for the record itself, so nothing here says how well converged a
// standing record is - that is the beatable-records question, which stays off the site.
import fs from "node:fs";
import { recordEligible } from "./units.mjs";
import { collect, recordOf, exactRecordOf } from "./summary.mjs";
import { FAMILIES, family } from "./views.mjs";
import { ladderFigures } from "./ladders.mjs";
import { W, PAD, n, text, hline, dot, tri, legend, header, footnote, doc, textWidth, writer, log, logScale, pow10, rowHref } from "./chart.mjs";

const OUT = "figures";
const instances = collect();
const { write, written } = writer(OUT);

const BOUNDS = { variational: 0, projected: 1, extrapolated: 2 };
const FLOOR = 1e-8; // relative gaps below this are drawn at the top edge, and counted

// The reference an instance's rows are measured against, and what kind it is.
function referenceOf(inst) {
  const exact = exactRecordOf(inst);
  if (exact) return { row: exact, kind: "exact" };
  const rec = recordOf(inst);
  return rec ? { row: rec, kind: "record" } : null;
}

// Every row that is a result rather than the answer: a bound or an extrapolation,
// unflagged, with a stated bound type. `gap` is relative to the reference energy;
// extrapolations and projections may land below an exact reference, and so may a sampled
// bound without an error bar below a record. The axis shows the absolute value, so such a
// row is `below`; it is `under` when it lies below by more than twice the joint error bar
// and further than the floor, which the exact-referenced figures leave undrawn.
function points(inst, ref) {
  return inst.rows
    .filter(r => r.bound_type in BOUNDS && !r.defect && r !== ref.row)
    .map(r => {
      const gap = Math.abs(r.energy - ref.row.energy) / Math.abs(ref.row.energy);
      const under = gap >= FLOOR && ref.row.energy - r.energy > 2 * Math.hypot(r.sigma ?? 0, ref.row.sigma ?? 0);
      return { r, inst, fam: family(r.method), eligible: recordEligible(r), below: r.energy < ref.row.energy, under, gap };
    });
}
const mark = (t, x, y, color, p) => (p.below ? tri : dot)(t, x, y, color, p.eligible, rowHref(p.inst, p.r));
const pin = (t, x, y, color, p) => dot(t, x, y, color, p.eligible, rowHref(p.inst, p.r));
const BELOW = t => ({ kind: "tri", color: t.ink2, label: "Below the energy it is measured against" });

// A log-log plot area: size along x with the ticks given, distance up y on the inverted
// decade scale (y0 is the top, y1 the bottom). With `exact`, a gap below y0 is placed on an
// "exact" line EXACT_RISE above the top gridline, and the Y returned does so.
const EXACT_RISE = 24;
function logPlot(t, parts, { left, right, top, bottom, x0, x1, y0, y1, xTicks, xLabel, yLabel, exact }) {
  const X = logScale(x0, x1, left, right), scale = logScale(y0, y1, top, bottom);
  const Y = exact ? g => (g < y0 ? top - EXACT_RISE : scale(g)) : scale;
  if (exact) {
    parts.push(hline(left, right, top - EXACT_RISE, t.muted));
    parts.push(text(left - 8, top - EXACT_RISE + 4, "exact", { size: 11, fill: t.ink2, anchor: "end" }));
  }
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

// The best gap at each size among a set of points, joined from size to size.
function best(pts) {
  return [...Map.groupBy(pts, p => p.inst.n_sites)].map(([N, ps]) => [N, Math.min(...ps.map(p => p.gap))]).sort((a, b) => a[0] - b[0]);
}
function frontier(pts, X, Y, color) {
  const steps = best(pts);
  if (steps.length < 2) return "";
  const d = steps.map(([N, g], k) => `${k ? "L" : "M"}${n(X(N))} ${n(Y(g))}`).join("");
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>`;
}

const exactRef = instances.map(i => [i, referenceOf(i)]).filter(([, ref]) => ref?.kind === "exact");
const all = exactRef.flatMap(([i, ref]) => points(i, ref)).filter(p => !p.under);
const under = exactRef.flatMap(([i, ref]) => points(i, ref)).filter(p => p.under).length;
const NS = all.map(p => p.inst.n_sites);
const X0 = 8, X1 = Math.max(...NS) * 1.4;
const Y0 = FLOOR, Y1 = 1;
const XT = [10, 30, 100, 300, 1000].filter(v => v <= X1);
const floored = all.filter(p => p.gap < FLOOR).length;
const UNDER = `${under} ${under === 1 ? "row lies" : "rows lie"} below the exact energy by more than twice the error bar and ${under === 1 ? "is" : "are"} not drawn.`;
const Y_LABEL = "relative gap to the instance's exact energy (better is higher)";

// ------------------------------------------------------ 1. every row against an exact energy
write("size-vs-accuracy", t => {
  const h = header(t, "The best published energies, by system size",
    `${all.length} energies on the ${exactRef.length} instances that have an exact ground-state energy, ` +
    "placed by their relative gap to it so that different Hamiltonians share one axis; a better energy is higher. Colour is the kind of number; filled marks can hold a record, hollow ones cannot.");
  const lg = legend(t, [
    { kind: "dot", color: t.series[0], label: "Variational bound" },
    { kind: "dot", color: t.series[1], label: "Projected (fixed-node)" },
    { kind: "dot", color: t.series[2], label: "Extrapolated" },
    { kind: "ring", color: t.ink2, label: "Listed, cannot hold a record" },
  ], h.bottom + 34);
  const top = lg.bottom + 28 + EXACT_RISE, bottom = top + 380, left = PAD + 62, right = W - PAD - 8;
  const parts = [h.svg, lg.svg];
  const { X, Y } = logPlot(t, parts, { left, right, top, bottom, x0: X0, x1: X1, y0: Y0, y1: Y1, xTicks: XT, xLabel: "sites", yLabel: Y_LABEL, exact: true });
  // Hollow first, then filled; within each, extrapolated and projected under variational.
  const order = [...all].sort((a, b) => (a.eligible - b.eligible) || (BOUNDS[b.r.bound_type] - BOUNDS[a.r.bound_type]));
  for (const p of order) parts.push(pin(t, X(p.inst.n_sites), Y(p.gap), t.series[BOUNDS[p.r.bound_type]], p));
  const fn = footnote(t, `Height is |E − E_exact| / |E_exact| on an inverted log scale, so that a better energy is higher; ${floored} rows closer than ${pow10(log(FLOOR))}, ` +
    `above or below, sit on the exact line. A row below the exact energy within twice the error bar is placed by the size of its gap. ${UNDER} ` +
    "No line joins the sizes: the instances at one size are different Hamiltonians, and a frontier across them would compare a Hubbard " +
    "energy with a Heisenberg one. Exact references are exact diagonalization or sign-problem-free QMC, exact within its error bar; flagged rows are not shown.", bottom + 58);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, "The best published energies, by system size",
    `Number of sites (x) against relative gap to the exact ground-state energy (y, inverted log scale, better is higher) for ${all.length} published energies on ${exactRef.length} exactly solved instances.`, parts);
});

// ------------------------------------------------------------- 2. the same, by method family
// Small multiples on shared axes: the family's rows in colour over every row in grey,
// with the family's best gap at each size as a line. Same caveat as above about the line:
// it joins different Hamiltonians, so it shows the family's reach, not one problem.
// The grey backdrop is the same cloud in every panel, so it is drawn once and placed with
// <use>: every row, the panel's own family included, since a coloured mark's surface ring
// covers its grey twin. One copy instead of one per panel took the file from 334 KB to
// 126 KB with the row links added, small enough for the front page to inline.
write("size-vs-accuracy-by-family", t => {
  const names = [...FAMILIES.map(f => f[0]), "other"].filter(f => all.some(p => p.fam === f));
  const cols = 2, rows = Math.ceil(names.length / cols);
  const h = header(t, "The best energies by system size, one panel per method family",
    "Each panel colours one family's energies over all the others in grey and joins the family's best energy at each size. " +
    "A method that only ever ran at one size is a lone mark.");
  const panelW = (W - 2 * PAD - 40) / cols, plotH = 160, pitch = plotH + 78 + EXACT_RISE;
  const top0 = h.bottom + 40 + EXACT_RISE, left0 = PAD + 58, cloudId = "size-vs-accuracy-by-family-grey";
  const CX = logScale(X0, X1, left0, PAD + panelW - 4), CYlog = logScale(Y0, Y1, top0, top0 + plotH);
  const CY = g => (g < Y0 ? top0 - EXACT_RISE : CYlog(g));
  const parts = [h.svg, `<defs><g id="${cloudId}" fill="${t.recessive[0]}">` +
    all.map(p => `<circle cx="${n(CX(p.inst.n_sites))}" cy="${n(CY(p.gap))}" r="2.5"/>`).join("") + "</g></defs>"];
  names.forEach((name, k) => {
    const col = k % cols, row = Math.floor(k / cols);
    const px = PAD + col * (panelW + 40), left = px + 58, right = px + panelW - 4;
    const top = top0 + row * pitch, bottom = top + plotH;
    const mine = all.filter(p => p.fam === name);
    parts.push(text(left, top - 12 - EXACT_RISE, `${name} (${mine.length})`, { size: 13, fill: t.ink, weight: 600 }));
    const { X, Y } = logPlot(t, parts, { left, right, top, bottom, x0: X0, x1: X1, y0: Y0, y1: Y1, xTicks: XT,
      xLabel: row === rows - 1 ? "sites" : null, yLabel: null, exact: true });
    parts.push(`<use href="#${cloudId}" x="${n(left - left0)}" y="${n(top - top0)}"/>`);
    parts.push(frontier(mine, X, Y, t.series[0]));
    for (const p of [...mine].sort((a, b) => a.eligible - b.eligible)) parts.push(pin(t, X(p.inst.n_sites), Y(p.gap), t.series[0], p));
  });
  const y = top0 + (rows - 1) * pitch + plotH + 62;
  const fn = footnote(t, "Families are assigned from the method string (views.mjs), first match wins; 'other' is what none of the patterns name. " +
    `Filled marks can hold a record, hollow ones cannot. Axes, the exact line included, as in the figure above: a better energy is higher. ${UNDER}`, y);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, "The best published energies by system size, one panel per method family",
    names.map(f => `${f}: ${all.filter(p => p.fam === f).length} energies`).join("; "), parts);
});

// ----------------------------------------------------------- 3. one figure per Hamiltonian
// The same Hamiltonian at growing sizes: one panel per ladder (ladders.mjs), one figure per
// model, lattice and boundary, which the site switches between. Where a size has no exact
// energy the reference is the record, and the size's label says so by colour; the record
// holder itself sits in the band above the plot. One line per method family through its
// best row at each size.
//
// A ladder is drawn where rows other than its references sit at two sizes or more, and only
// those sizes are: one size is the instance's own table, and a size holding nothing but its
// reference has no result to place. The directory is emptied first, as figures/cost/ is,
// so the site never inlines a figure for a ladder that no longer qualifies.
const SIZE_DIR = `${OUT}/size`;
fs.rmSync(SIZE_DIR, { recursive: true, force: true });
fs.mkdirSync(SIZE_DIR, { recursive: true });

function ladderOf({ label, members }) {
  const withRef = members.map(i => [i, referenceOf(i)]).filter(([, ref]) => ref);
  const pts = withRef.flatMap(([i, ref]) => points(i, ref).map(p => ({ ...p, ref: ref.kind })));
  const sizes = [...new Set(pts.map(p => p.inst.n_sites))].sort((a, b) => a - b);
  const holders = withRef.filter(([i, ref]) => ref.kind === "record" && pts.some(p => p.inst === i)).map(([i, ref]) => ({ inst: i, r: ref.row }));
  const kind = N => (pts.some(p => p.inst.n_sites === N && p.ref === "record") ? "record" : "exact");
  const title = [label, `${pts.length + holders.length} energies at ${sizes.length} sizes`].filter(Boolean).join(": ");
  return { label, title, members, pts, sizes, holders, kind };
}

// One tick per size, the label coloured as the caller says and dropped where it would run
// into the previous one (the Heisenberg square has 29 sizes).
function sizeTicks(t, parts, X, sizes, bottom, fill) {
  let lastEnd = -Infinity;
  for (const N of sizes) {
    const x = X(N), w = textWidth(String(N), 11);
    parts.push(`<path d="M${n(x)} ${n(bottom)}v4" stroke="${t.grid}" stroke-width="1"/>`);
    if (x - w / 2 < lastEnd + 6) continue;
    parts.push(text(x, bottom + 18, String(N), { size: 11, fill: fill(N), anchor: "middle", nums: true }));
    lastEnd = x + w / 2;
  }
}

function ladderPanel(t, parts, L, { left, right, top, bottom }) {
  const band = top - 22;
  parts.push(text(left, band - 24, L.title, { size: 13, fill: t.ink, weight: 600 }));
  const { X, Y } = logPlot(t, parts, { left, right, top, bottom, x0: L.sizes[0] / 1.5, x1: L.sizes.at(-1) * 1.5, y0: Y0, y1: Y1, xTicks: [], xLabel: null, yLabel: null });
  sizeTicks(t, parts, X, L.sizes, bottom, N => (L.kind(N) === "exact" ? t.muted : t.series[1]));
  // The record holders' band, above the plot: gap zero by construction.
  if (L.holders.length) {
    parts.push(hline(left, right, band, t.grid));
    parts.push(text(left - 8, band + 4, "holds the record", { size: 9.5, fill: t.muted, anchor: "end" }));
    for (const hd of L.holders) parts.push(dot(t, X(hd.inst.n_sites), band, t.ink2, true, rowHref(hd.inst, hd.r)));
  }
  // One line per family through its best row at each size; the overall best on top.
  const ends = [];
  for (const [fam, ps] of Map.groupBy(L.pts, p => p.fam)) {
    const line = frontier(ps, X, Y, t.recessive[1]);
    if (line) {
      parts.push(line);
      const [N, g] = best(ps).at(-1);
      ends.push({ fam, x: X(N) + 9, y: Y(g) + 4 });
    }
  }
  parts.push(frontier(L.pts, X, Y, t.series[0]));
  for (const p of [...L.pts].sort((a, b) => a.eligible - b.eligible)) parts.push(mark(t, X(p.inst.n_sites), Y(p.gap), t.ink2, p));
  // Family names at the right end of each line, nudged apart where two would collide.
  ends.sort((a, b) => a.y - b.y);
  for (let a = 1; a < ends.length; a++) if (ends[a].y - ends[a - 1].y < 13) ends[a].y = ends[a - 1].y + 13;
  for (const e of ends) {
    const w = textWidth(e.fam, 10.5);
    const x = e.x + w > right + 30 ? e.x - 18 - w : e.x;
    parts.push(text(x, e.y, e.fam, { size: 10.5, fill: t.ink2 }));
  }
}

// Panels in two columns, or one full-width panel; `draw` fills a box, and the grid returns
// the y below its last row.
function grid(count, top0, { plotH, gap, draw }) {
  const cols = count === 1 ? 1 : 2, panelW = (W - 2 * PAD - 40 * (cols - 1)) / cols;
  for (let k = 0; k < count; k++) {
    const col = k % cols, row = Math.floor(k / cols);
    const px = PAD + col * (panelW + 40), top = top0 + row * (plotH + gap);
    draw(k, { px, left: px + 58, right: px + panelW - 4, top, bottom: top + plotH });
  }
  return top0 + (Math.ceil(count / cols) - 1) * (plotH + gap) + plotH;
}

const FIGS = ladderFigures(instances)
  .map(f => ({ ...f, panels: f.ladders.map(ladderOf).filter(L => L.sizes.length >= 2) }))
  .filter(f => f.panels.length);

for (const f of FIGS) write(f.name, t => {
  const title = `${f.title}: the best energies at each size`;
  const h = header(t, title,
    `${f.panels.length === 1 ? "One Hamiltonian" : `${f.panels.length} Hamiltonians, one panel per set of couplings`}, at every size with a published result. ` +
    "Each size is placed against its exact energy where it has one (sizes in grey), otherwise against the standing record (sizes in orange), " +
    "whose holder then sits in the band above the plot. One line per method family through its best energy at each size; a better energy is higher.");
  const lg = legend(t, [
    { kind: "line", color: t.series[0], label: "Best at each size" },
    { kind: "line", color: t.recessive[1], label: "One method family" },
    { kind: "dot", color: t.ink2, label: "Can hold a record" },
    { kind: "ring", color: t.ink2, label: "Cannot" },
    BELOW(t),
  ], h.bottom + 34);
  const parts = [h.svg, lg.svg];
  const end = grid(f.panels.length, lg.bottom + 90, { plotH: f.panels.length === 1 ? 240 : 200, gap: 120,
    draw: (k, box) => ladderPanel(t, parts, f.panels[k], box) });
  const fn = footnote(t, "Sizes are numbers of sites. A family's line joins its best energy at each size, whichever paper set it, so a line is a family's " +
    "reach rather than one calculation. Where the reference is the record, the heights say how far behind the others are and nothing about the record itself.", end + 44);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, title, f.panels.map(L => `${L.title}, sizes ${L.sizes.join(", ")}`).join("; "), parts);
});

console.log(`${OUT}/: ${written.length} files (size vs accuracy: ${all.length} exact-referenced energies on ${exactRef.length} instances, ${floored} at the floor; ` +
  `${FIGS.length} per-Hamiltonian figures, ${FIGS.reduce((a, f) => a + f.panels.length, 0)} ladders)`);
