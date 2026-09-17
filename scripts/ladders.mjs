// The size ladders: instances of one Hamiltonian that differ only in their size. The size
// figures (size_accuracy.mjs) draw one panel per ladder and the site switches between
// them. They are grouped from the instances rather than listed by hand, so a new size of
// a Hamiltonian joins its ladder and a Hamiltonian published at a second size gets one.
//
// A ladder is one model, lattice, boundary and set of couplings: J2, h, U, V, the filling
// per site (not Nf, which grows with the size) and any named variant in the instance id
// (t12, UV1V2). Clusters of one lattice share a ladder (kagome-36a and kagome-8x8 are both
// kagome); rectangles share one only at the same first side, so a ladder of rectangles
// grows in length at fixed width. An impurity "lattice" names the impurity problem
// (TB-DMFT-SOC) and is kept whole.
//
// Ladders sharing model and lattice are one figure - an impurity problem's lattice is its
// first two words - and the site shows one figure at a time behind two rows of badges, the
// model and then the lattice: one badge per figure rather than per ladder, as the panels of
// a figure differ only in boundary and couplings.
import { MODELS, BOUNDARY } from "./readme_table.mjs";

const COUPLINGS = ["J2", "h", "U", "V"];

// Particles per site: Hubbard files carry Nf = N_up = N_dn, t-V is spinless.
const fillingOf = inst => inst.params?.Nf == null ? null
  : Number(((inst.model === "Hubbard" ? 2 : 1) * inst.params.Nf / inst.n_sites).toFixed(4));
const latticeOf = inst => (inst.model === "Impurity" ? inst.lattice.split("-").slice(0, 2).join("-") : inst.lattice.replace(/-.*$/, ""));
const widthOf = inst => inst.lattice.match(/^rectangular-(\d+)x\d+$/)?.[1] ?? null;
const variantsOf = inst => inst.instance_id.split("/")[1].split("_").slice(2)
  .filter(s => /[A-Za-z]/.test(s) && !(s in BOUNDARY) && s !== "P");

export const modelName = model => MODELS.find(([m]) => m === model)?.[1] ?? model;

// The words for a ladder's couplings, empty for a Heisenberg model: "J2 = 0.5",
// "U = 8, n = 0.875", "4 × L, U = 8, n = 0.875". The boundary leads where the figure has
// more than one, and an impurity problem's full name where its figure holds several.
function couplingLabel(inst, { boundary, lattice }) {
  const parts = [];
  if (lattice) parts.push(inst.lattice);
  if (boundary) parts.push(BOUNDARY[inst.boundary] ?? "periodic");
  const w = widthOf(inst);
  if (w) parts.push(`${w} × L`);
  for (const k of COUPLINGS) if (inst.params?.[k] != null) parts.push(`${k} = ${inst.params[k]}`);
  const f = fillingOf(inst);
  if (f != null) {
    const exact = (inst.model === "Hubbard" ? 2 : 1) * inst.params.Nf / inst.n_sites;
    parts.push(`n ${f === exact ? "=" : "≈"} ${f}`);
  }
  return [...parts, ...variantsOf(inst)].join(", ");
}

// The figure's lattice badge, "square", "kagome", "TB-DMFT", with the boundary where all
// of its ladders share a non-periodic one.
const latticeLabel = (inst, oneBoundary) => [latticeOf(inst), oneBoundary && BOUNDARY[inst.boundary]].filter(Boolean).join(", ");

// Every figure, in model order and then by energies, most first; each with its ladders
// ordered by their couplings. Ladders are not filtered here: which of them have enough to
// draw is the figure script's call, and the site reads which figures exist off figures/size/.
export function ladderFigures(instances) {
  const figKey = i => `${i.model}--${latticeOf(i)}`;
  const ladderKey = i => [i.model === "Impurity" ? i.lattice : "", i.boundary, widthOf(i), ...COUPLINGS.map(k => i.params?.[k]), fillingOf(i), ...variantsOf(i)].join("|");
  const order = i => [Object.keys(BOUNDARY).indexOf(i.boundary), -(fillingOf(i) ?? 0), +(widthOf(i) ?? 0), ...COUPLINGS.map(k => i.params?.[k] ?? 0)];
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
      ladders: [...Map.groupBy(members, ladderKey).values()]
        .map(ms => ({ label: couplingLabel(ms[0], { boundary: !oneBoundary, lattice: !oneLattice }), members: [...ms].sort((a, b) => a.n_sites - b.n_sites) }))
        .sort((a, b) => cmp(a.members[0], b.members[0])),
    };
  }).sort((a, b) => MODELS.findIndex(([m]) => m === a.model) - MODELS.findIndex(([m]) => m === b.model) ||
    b.energies - a.energies || a.name.localeCompare(b.name));
}
