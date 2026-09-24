// The instances QMBL measures an ED cost on (Tristan, 2026-09-23/24; checks/cost/README.md,
// "QMBL-measured ED cost"): every instance with an exact-diagonalization row and at most 30
// sites. For each, what run_ed.py needs (model, lattice, parameters, the stored exact energy
// it must reproduce) and what the dry pass decides with: the conserved sector's dimension and
// the memory a stored sparse matrix needs. Instances whose lattice this repository does not
// define, or whose matrix does not fit a node, are listed with the reason and not run.
//   node checks/cost/ed/make_worklist.mjs      (from the repo root; writes checks/cost/ed/worklist.json)
import fs from "node:fs";
import { collect } from "../../../scripts/summary.mjs";
import { connectedOf } from "../../../scripts/flops.mjs";

const MAX_SITES = 30;
// A node of Euler's normal partitions has 250 GB; a job asks for its estimate plus a margin.
const MAX_GB = 180;
const isED = r => r.bound_type === "exact" && /diagonal|\bED\b|Lanczos/i.test(`${r.method || ""} ${r.method_as_published || ""}`);
const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); };

// Lattices run_ed.py builds (ed_instances.py); anything else is not defined in this repository.
function supported(inst) {
  const { model, lattice, boundary } = inst;
  if (model === "Impurity") return /^SB-/.test(inst.instance_id.split("/")[1]) ? null : "three-band impurity: outside the single-band builder";
  if (lattice === "chain") return null;
  if (lattice === "square" && boundary === "P" && Number.isInteger(Math.sqrt(inst.n_sites))) return null;
  if (/^rectangular-\d+x\d+$/.test(lattice) && boundary === "P") return null;
  if (lattice === "triangular" && boundary === "P" && Number.isInteger(Math.sqrt(inst.n_sites))) return null;
  if (lattice === "kagome-2x3" && boundary === "P") return null; // VarBench's own edge list (programs/dmrg_itensors/heisenberg_kagome.jl)
  return `lattice ${lattice} (${boundary}): its cluster is defined only in the source paper, not in this repository`;
}

function sector(inst) {
  const N = inst.n_sites, p = inst.params || {};
  switch (inst.model) {
    case "Heisenberg": case "J1J2": return { dim: C(N, N / 2), conserved: "total Sz = 0" };
    case "TFIsing": return { dim: 2 ** N, conserved: "none (no U(1) symmetry)" };
    case "Hubbard": return { dim: C(N, p.Nf) ** 2, conserved: `N_up = N_dn = ${p.Nf}` };
    case "tV": return { dim: C(N, p.Nf), conserved: `N = ${p.Nf}` };
    case "Impurity": {
      const dof = inst.rows.find(isED)?.dof, L = N + 1; // impurity + bath sites per spin
      return dof ? { dim: C(L, dof / 2) ** 2, conserved: `N_up = N_dn = ${dof / 2}` } : { dim: null, conserved: null };
    }
  }
  return { dim: null, conserved: null };
}

const out = [];
for (const inst of collect()) {
  if (inst.n_sites > MAX_SITES || !inst.rows.some(isED)) continue;
  const { dim, conserved } = sector(inst);
  // Off-diagonal elements per row: a spin-flip pair on about half the bonds, every hop for fermions.
  const conn = connectedOf(inst) ?? 4 * (inst.n_sites + 1);
  const perRow = inst.model === "Heisenberg" || inst.model === "J1J2" ? conn / 2 + 1 : conn + 1;
  // CSR twice over while the blocks are stacked, ~25 Lanczos vectors, a block of connections and the imports.
  const gb = dim ? +((dim * perRow * 12 * 2.2 + dim * 8 * 25) / 1e9 + 3).toFixed(2) : null;
  const why = supported(inst) ?? (gb != null && gb > MAX_GB ? `stored matrix needs about ${Math.round(gb)} GB, more than a ${MAX_GB} GB job` : null);
  out.push({
    instance_id: inst.instance_id, model: inst.model, lattice: inst.lattice, boundary: inst.boundary, n_sites: inst.n_sites, params: inst.params,
    exact: inst.rows.filter(isED).map(r => ({ energy: r.energy, method: r.method_as_published ?? r.method, dof: r.dof, reference: r.reference })),
    sector_dimension: dim, conserved, memory_gb_estimate: gb, run: !why, skip_reason: why,
  });
}
out.sort((a, b) => (a.sector_dimension ?? 0) - (b.sector_dimension ?? 0));
fs.writeFileSync("checks/cost/ed/worklist.json", JSON.stringify(out, null, 1) + "\n");
const skip = out.filter(o => !o.run);
console.log(`ED worklist: ${out.length} instances, ${out.length - skip.length} to run, ${skip.length} not run`);
for (const o of skip) console.log(`  not run: ${o.instance_id}: ${o.skip_reason}`);
