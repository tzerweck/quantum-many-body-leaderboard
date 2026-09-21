// The size ladders: instances of one Hamiltonian that differ only in their size. The size
// figures (size_accuracy.mjs) draw one panel per ladder and the site switches between
// them. They are grouped from the instances rather than listed by hand, so a new size of
// a Hamiltonian joins its ladder and a Hamiltonian published at a second size gets one.
//
// A ladder is one model, lattice, boundary and set of couplings: J2, h, U, V, the filling
// per site (not Nf, which grows with the size) and any named variant in the instance id
// (t12, UV1V2). Clusters of one lattice share a ladder (kagome-36a and kagome-8x8 are both
// kagome); rectangles share one at the same first side, so a ladder of rectangles grows in
// length at fixed width, and at the same aspect ratio where no two widths match (the 1:2
// Heisenberg cylinders). An impurity "lattice" names the impurity problem (TB-DMFT-SOC) and
// is kept whole.
//
// Ladders sharing model and lattice are one figure - an impurity problem's lattice is its
// first two words - and the site shows one figure at a time behind two rows of badges, the
// model and then the lattice: one badge per figure rather than per ladder, as the ladders of
// a figure differ only in boundary and couplings.
//
// energyFigures() is what the site shows: each figure as stops along one strip, grouped in
// facets (a slider on the site), and one "other" figure per model for what was published at
// a single size and shares no strip, so that nothing on the table is missing from the page.
import { MODELS, BOUNDARY, geometry } from "./readme_table.mjs";
import { groundStateExact } from "./units.mjs";
import { W, PAD } from "./chart.mjs";

const COUPLINGS = ["J2", "h", "U", "V"];

// Particles per site: Hubbard files carry Nf = N_up = N_dn, t-V is spinless.
const fillingOf = inst => inst.params?.Nf == null ? null
  : Number(((inst.model === "Hubbard" ? 2 : 1) * inst.params.Nf / inst.n_sites).toFixed(4));
const fillingLabel = inst => {
  const f = fillingOf(inst), exact = (inst.model === "Hubbard" ? 2 : 1) * inst.params.Nf / inst.n_sites;
  return `n ${f === exact ? "=" : "≈"} ${f}`;
};
const latticeOf = inst => (inst.model === "Impurity" ? inst.lattice.split("-").slice(0, 2).join("-") : inst.lattice.replace(/-.*$/, ""));
const sidesOf = inst => inst.lattice.match(/^rectangular-(\d+)x(\d+)$/)?.slice(1).map(Number) ?? null;
const variantsOf = inst => inst.instance_id.split("/")[1].split("_").slice(2)
  .filter(s => /[A-Za-z]/.test(s) && !(s in BOUNDARY) && s !== "P");
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// The rows a figure draws: a bound, a projection, an extrapolation or a ground-state exact
// energy. A flagged row is drawn too, with a slashed mark (Tristan, 2026-09-18: the reader
// sees the number and that it is contested; RULES.md 6.1 keeps it off the records and so
// off the record line), except a row flagged wrong-instance, whose energy belongs on
// another axis. Rows without a bound type and sector-resolved diagonalizations are not.
const BOUNDS = new Set(["variational", "projected", "extrapolated"]);
export const drawnRows = inst => inst.rows.filter(r => r.defect?.flag !== "wrong-instance" && (r.bound_type === "exact" ? groundStateExact(r) : BOUNDS.has(r.bound_type)));

export const modelName = model => MODELS.find(([m]) => m === model)?.[1] ?? model;

// The words for a ladder's couplings, empty for a Heisenberg model: "J2 = 0.5",
// "U = 8, n = 0.875", "4 × L, U = 8, n = 0.875", "L × 2L". The boundary leads where the
// figure has more than one, and an impurity problem's full name where its figure holds several.
// With `omit`, that coupling (or the filling, "n") is left out: a facet's label names what its
// stops share, not the axis they differ in.
function couplingLabel(inst, { boundary, lattice, shape, omit }) {
  const parts = [];
  if (lattice) parts.push(inst.lattice);
  if (boundary) parts.push(BOUNDARY[inst.boundary] ?? "periodic");
  if (shape) parts.push(shape.label);
  for (const k of COUPLINGS) if (k !== omit && inst.params?.[k] != null) parts.push(`${k} = ${inst.params[k]}`);
  if (omit !== "n" && fillingOf(inst) != null) parts.push(fillingLabel(inst));
  return [...parts, ...variantsOf(inst)].join(", ");
}

// A rectangle's ladder: its width, or its aspect ratio where no other size shares the width.
function rectangleShapes(instances) {
  const shapes = new Map();
  const base = i => [i.model, i.boundary, ...COUPLINGS.map(k => i.params?.[k]), fillingOf(i), ...variantsOf(i)].join("|");
  const rects = instances.filter(sidesOf);
  for (const ms of Map.groupBy(rects, i => `${base(i)}|${sidesOf(i)[0]}`).values()) {
    const oneSize = new Set(ms.map(i => i.n_sites)).size < 2;
    for (const i of ms) {
      const [a, b] = sidesOf(i), g = gcd(a, b), m = s => (s / g === 1 ? "L" : `${s / g}L`);
      shapes.set(i, oneSize ? { key: `${a / g}:${b / g}`, label: `${m(a)} × ${m(b)}` } : { key: `W${a}`, label: `${a} × L` });
    }
  }
  return shapes;
}

// The figure's lattice badge, "square", "kagome", "TB-DMFT", with the boundary where all
// of its ladders share a non-periodic one.
const latticeLabel = (inst, oneBoundary) => [latticeOf(inst), oneBoundary && BOUNDARY[inst.boundary]].filter(Boolean).join(", ");

// Every figure, in model order and then by energies, most first; each with its ladders
// ordered by their couplings. Ladders are not filtered here: which of them have enough to
// draw is the figure script's call, and the site reads which figures exist off figures/size/.
export function ladderFigures(instances) {
  const shapes = rectangleShapes(instances);
  const figKey = i => `${i.model}--${latticeOf(i)}`;
  const ladderKey = i => [i.model === "Impurity" ? i.lattice : "", i.boundary, shapes.get(i)?.key, ...COUPLINGS.map(k => i.params?.[k]), fillingOf(i), ...variantsOf(i)].join("|");
  const order = i => [Object.keys(BOUNDARY).indexOf(i.boundary), -(fillingOf(i) ?? 0), +(sidesOf(i)?.[0] ?? 0), ...COUPLINGS.map(k => i.params?.[k] ?? 0)];
  const cmp = (a, b) => { const x = order(a), y = order(b); for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] - y[k]; return 0; };
  const energies = is => is.reduce((a, i) => a + i.rows.length, 0);
  return [...Map.groupBy(instances, figKey)].map(([key, members]) => {
    const oneBoundary = new Set(members.map(i => i.boundary)).size === 1;
    const oneLattice = new Set(members.map(i => i.lattice)).size === 1 || members[0].model !== "Impurity";
    return {
      name: `size/${key.replace(/[^\w.-]/g, "_")}`,
      model: members[0].model,
      label: latticeLabel(members[0], oneBoundary),
      title: `${modelName(members[0].model)} ${latticeLabel(members[0], oneBoundary)}`,
      energies: energies(members),
      flags: { boundary: !oneBoundary, lattice: !oneLattice },
      ladders: [...Map.groupBy(members, ladderKey).values()]
        .map(ms => ({ label: couplingLabel(ms[0], { boundary: !oneBoundary, lattice: !oneLattice, shape: shapes.get(ms[0]) }),
          shape: shapes.get(ms[0]), members: [...ms].sort((a, b) => a.n_sites - b.n_sites) }))
        .sort((a, b) => cmp(a.members[0], b.members[0])),
    };
  }).sort((a, b) => MODELS.findIndex(([m]) => m === a.model) - MODELS.findIndex(([m]) => m === b.model) ||
    b.energies - a.energies || a.name.localeCompare(b.name));
}

// What varies between Hamiltonians published at one size: a coupling, the filling, or the
// named variant. Each value is a string for grouping and a number (or name) for ordering.
const SCAN = {
  J2: { of: i => i.params?.J2, label: "J2" }, h: { of: i => i.params?.h, label: "h" },
  U: { of: i => i.params?.U, label: "U" }, V: { of: i => i.params?.V, label: "V" },
  n: { of: fillingOf, label: "filling n" }, variant: { of: i => variantsOf(i).join(", "), label: "variant" },
};

// The Hamiltonians published at one size, as panels: those sharing lattice, boundary and
// size are one panel with the quantity that varies most between them along x, split by
// whatever else varies. A Hamiltonian with no such neighbour is a panel of one.
function scansOf(instances) {
  const panels = [];
  for (const group of Map.groupBy(instances, i => [i.lattice, i.boundary, i.n_sites].join("|")).values()) {
    const distinct = k => new Set(group.map(i => String(SCAN[k].of(i) ?? ""))).size;
    const varying = Object.keys(SCAN).filter(k => distinct(k) > 1).sort((a, b) => distinct(b) - distinct(a));
    const [x, ...rest] = varying;
    for (const ms of Map.groupBy(group, i => rest.map(k => SCAN[k].of(i)).join("|")).values()) {
      const inst = ms[0];
      const parts = [geometry(inst), BOUNDARY[inst.boundary]];
      for (const k of COUPLINGS) if (k !== x && inst.params?.[k] != null) parts.push(`${k} = ${inst.params[k]}`);
      if (x !== "n" && fillingOf(inst) != null) parts.push(fillingLabel(inst));
      if (x !== "variant") parts.push(...variantsOf(inst));
      const slots = [...Map.groupBy(ms, i => String(x ? SCAN[x].of(i) ?? "" : ""))]
        .map(([label, members]) => {
          const at = x ? SCAN[x].of(members[0]) : 0;
          return { label: !x ? "" : typeof at === "number" ? String(Number(at.toPrecision(3))) : label || "none", members, at };
        })
        .sort((a, b) => (typeof a.at === "number" ? a.at - b.at : String(a.at).localeCompare(String(b.at))));
      panels.push({ label: parts.filter(Boolean).join(", "), x: x ? SCAN[x].label : null, slots, n_sites: inst.n_sites });
    }
  }
  return panels.sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
}

// The strip a slider shows above its panel (size_energy.mjs): its plot box is shared with the
// site, which sets a badge under each stop at the stop's x. Stops sit at even spacing in their
// own order, as the couplings of an "other" panel do: placed by value, the badges for J2 = 0.4,
// 0.45, 0.5, 0.55, 0.6 ran into each other (Tristan, 2026-09-18). Above the plot is room for
// the size lines to move apart when the strip is hovered (size_energy.mjs), and above that
// the facet labels and the legend.
export const STRIP = { left: PAD + 56, right: W - PAD - 10, top: 92, bottom: 252, labelY: 40 };
export const stripX = (k, count) => STRIP.left + ((k + 0.5) / count) * (STRIP.right - STRIP.left);

const AXES = ["J2", "h", "U", "V", "n"];
const slug = s => s.replace(/[^\w.]+/g, "_").replace(/^_+|_+$/g, "");
const multiSize = L => new Set(L.members.map(i => i.n_sites)).size >= 2;
const drawnCount = L => L.members.reduce((a, i) => a + drawnRows(i).length, 0);
const valueLabel = at => (typeof at === "number" ? String(Number(at.toPrecision(3))) : String(at));

// The figures on the site, in model order with the "other" figures last. A figure (a model
// and lattice) is shown as facets, a facet being the ladders that differ only in the
// figure's axis: the coupling or filling with most distinct values among the ladders drawn
// at two sizes or more (J2 for J1-J2, U for Hubbard). On the site a figure is one slider
// (Tristan, 2026-09-21, in place of a slider per facet): one strip of the record at every
// stop and size, the facets as groups along it with an empty slot between them, a badge
// under each stop, and one panel per stop, the stop with most energies shown first. A
// ladder published at one size is a stop like any other where its facet has a ladder with
// sizes (Tristan, 2026-09-18: J2 = 0.35 at 36 sites belongs beside J2 = 0.3 and 0.4, not
// under Other); where nothing in its facet has, it goes to the model's "other" figure, the
// scan panels of what was published at one size. A figure without an axis is one facet per
// ladder, each a single stop that its badge names, with no gaps between them; a figure of
// one stop has no strip, the panel alone.
export function energyFigures(instances) {
  const figs = [], single = [];
  for (const f of ladderFigures(instances)) {
    const ladders = f.ladders.map(L => ({ ...L, members: L.members.filter(i => drawnRows(i).length) })).filter(L => L.members.length);
    const sized = ladders.filter(multiSize);
    if (!sized.length) { single.push(...ladders.flatMap(L => L.members)); continue; }
    const distinct = (ls, k) => new Set(ls.map(L => String(SCAN[k].of(L.members[0]) ?? ""))).size;
    const [axisKey, values] = AXES.map(k => [k, distinct(sized, k)]).sort((a, b) => b[1] - a[1])[0];
    const axis = values > 1 ? axisKey : null;
    const facetKey = L => { const i = L.members[0]; return [i.model === "Impurity" ? i.lattice : "", i.boundary, L.shape?.key, ...AXES.filter(k => k !== axis).map(k => SCAN[k].of(i)), ...variantsOf(i)].join("|"); };
    const name = f.name.replace(/^size\//, "energy/");
    const facets = [];
    for (const group of Map.groupBy(ladders, facetKey).values()) {
      if (!group.some(multiSize)) { single.push(...group.flatMap(L => L.members)); continue; }
      const label = couplingLabel(group[0].members[0], { ...f.flags, shape: group[0].shape, omit: axis });
      const base = [name, slug(label)].filter(Boolean).join("--");
      const stops = group.map(L => {
        const at = axis ? SCAN[axis].of(L.members[0]) : null;
        return { at, label: axis ? valueLabel(at) : L.label, name: axis ? `${base}--${axis}_${valueLabel(at)}` : base, energies: drawnCount(L), ladder: L };
      }).sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
      facets.push({ label, stops });
    }
    // The strip's slots: the stops in facet order, an empty slot between facets where the
    // figure has an axis and the facets are groups along it.
    const stops = facets.flatMap(x => x.stops);
    const total = stops.length + (axis ? facets.length - 1 : 0);
    let slot = 0;
    facets.forEach((x, g) => { if (g && axis) slot++; for (const s of x.stops) s.x = stripX(slot++, total); });
    const start = stops.indexOf(stops.reduce((best, s) => (s.energies > best.energies ? s : best), stops[0]));
    figs.push({ name, model: f.model, label: f.label, title: f.title, energies: f.energies, group: f.model, axis: axis && SCAN[axis].label, facets, stops, start,
      strip: total > 1 ? `${name}--strip` : null, pitch: total > 1 ? stripX(1, total) - stripX(0, total) : null });
  }
  const others = [...Map.groupBy(single, i => i.model)]
    .sort(([a], [b]) => MODELS.findIndex(([m]) => m === a) - MODELS.findIndex(([m]) => m === b))
    .map(([model, members]) => ({ name: `energy/other--${model}`, group: "other", model, label: modelName(model),
      title: `${modelName(model)}: Hamiltonians published at one size`, energies: members.reduce((a, i) => a + drawnRows(i).length, 0), scans: scansOf(members) }));
  // Every file once: two facets whose labels slug alike would overwrite each other.
  const names = figs.flatMap(f => [f.strip, ...f.stops.map(s => s.name)]).filter(Boolean);
  if (new Set(names).size !== names.length) throw new Error("ladders.mjs: two energy figures share a file name");
  return [...figs, ...others];
}
