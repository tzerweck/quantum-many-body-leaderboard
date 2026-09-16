// Rows from a paper's own data release, where the number a row needs is plotted in the
// paper but printed nowhere in it.
//
// The case that opened this pass: Moss et al. (arXiv:2502.17144) ran their 2D RNN on the
// square-lattice Heisenberg AFM up to 32x32 periodic and 24x24 open, and Table III prints
// only the zero-variance extrapolation per L; the energies the wavefunctions actually
// reached appear as points in Fig. 3(a) and Fig. 12(a). Table V prints the achieved
// ("best RNN") energy for L = 6 and L = 10 only. So the table carried an `extrapolated`
// row on every large size and no `variational` row from the paper at all, and asked why
// (2026-09-16). The authors' repository (github.com/mschuylermoss/HeisenbergRNN, commit
// 29bf62ac28, "reproduce figures") commits the pickle behind those figures: final
// energy, variance and Monte-Carlo standard error for every (boundary, schedule s, rate r,
// L). Read locally with pickle + numpy, copied whole into
// sources/2502.17144-repo-final_energy_data.json so a clone can check every row; the
// four values Table V does print are reproduced to their printed digits, which is the
// check that the file is the paper's data and the units are the paper's (E/N, S.S).
//
// The variance column is the variance of the per-site local energy, Var(H)/N^2: the
// repository's own V-score notebook computes N * var / E^2 from it and its commented
// reference lines reproduce VarBench's V-scores for DMRG 6x6/10x10 and the Jastrow
// baseline, and std_error^2 * 10^4 = var with the 10^4 samples the Fig. 3 caption states.
// Totals therefore scale with N^2 here, not with N as for a printed sigma^2/N_site
// (add_allresults_rows).
//
// One row per (instance): the lowest energy over the ten training schedules, which is
// what the paper calls its best RNN and what Table V prints where it prints anything.
// The run that produced it is named in the note. Sizes Table V already covers are
// skipped by the duplicate check against the tree as built.
import fs from "node:fs";
import { perSiteDivisor, expectedDof, expectedEinf, vScore } from "./units.mjs";

const CHECKED = "2026-09-16";
const SRC = JSON.parse(fs.readFileSync("sources/2502.17144-repo-final_energy_data.json", "utf8"));
const REF = "Moss, Wiersema, Hibat-Allah, Carrasquilla & Melko, Leveraging recurrence in neural network wavefunctions for large-scale simulations of Heisenberg antiferromagnets on the square lattice, Phys. Rev. B (2025), arXiv:2502.17144";
const METHOD = { periodic: "2D RNN wavefunction (best variational)", open: "2D tensorized-GRU RNN wavefunction, best variational (own)" };
// Ansatz-scope compute as the compute pass of 2026-09-16 read it from the paper (Table I,
// Fig. 3/12 captions, Fig. 7/8 captions, Appendix C); the same block the paper's other rows
// carry, since the parameter count and the sampling are per ansatz, not per row.
const COMPUTE = {
  periodic: { parameters: 791554, gpu_hours: null, device: "NVIDIA A100", n_devices: 4, samples: 10000, wall_clock: null, cpu_core_hours: null, bond_dimension: null, iterations: null,
    reported_as: "TABLE I: PBC 2D RNN (GRU cell), d_h = 256, total # 791,554. FIG. 3 caption: All of the final variational energies were estimated with 10 x 10^3 samples. FIG. 7/8 captions: four A100 GPUs. Appendix C: N_steps(L, s, r) = s x C exp(-r(L - 6)) + F, C = 101 x 10^3, F = 2 x 10^3.",
    source: "Table I (Appendix B), Fig. 3 caption, Fig. 7 and Fig. 8 captions (Appendix D), Appendix C, arXiv:2502.17144 (compute pass 2026-09-16, block reused for the repository rows)",
    scope: "ansatz", confidence: "high",
    note: "Parameter count is for the PBC 2D RNN with d_h = 256, shared across all L (iterative retraining from L = 6), so scope is the ansatz. Four A100s is stated for the PBC timing runs; per-L wall clock is plotted only (Fig. 7, 8). The step count for this row follows from the schedule formula with the (s, r) named in the verification note but is not printed as a number, so iterations stays null." },
  open: { parameters: 1180674, gpu_hours: null, device: null, n_devices: null, samples: 10000, wall_clock: null, cpu_core_hours: null, bond_dimension: null, iterations: null,
    reported_as: "TABLE I: OBC 2D RNN (tensorized GRU cell), d_h = 256, total # 1,180,674. FIG. 12 caption: All of the final variational energies were estimated with 10k samples. Appendix C training schedule as for PBC: N_steps = s x C exp(-r(L - 6)) + F, C = 101 x 10^3, F = 2 x 10^3.",
    source: "Table I (Appendix B), Fig. 12 caption, Appendix C, arXiv:2502.17144 (compute pass 2026-09-16, block reused for the repository rows)",
    scope: "ansatz", confidence: "high",
    note: "Parameter count is for the OBC (tensorized-GRU) 2D RNN with d_h = 256, shared across all L, so scope is the ansatz. No hardware or run time is stated for the OBC runs. The step count for this row follows from the schedule formula with the (s, r) named in the verification note but is not printed as a number, so iterations stays null." },
};

// lowest energy per (boundary, L)
const best = new Map();
for (const r of SRC.runs) {
  const k = `${r.boundary}/${r.L}`;
  if (!best.has(k) || r.energy_per_site < best.get(k).energy_per_site) best.set(k, r);
}

let added = 0;
const skipped = [];
for (const r of [...best.values()].sort((a, b) => a.boundary.localeCompare(b.boundary) || a.L - b.L)) {
  const id = `Heisenberg/square_${r.L * r.L}_${r.boundary === "periodic" ? "P" : "O"}`;
  const p = `data/${id}.json`;
  if (!fs.existsSync(p)) { console.log(`MISS instance ${id}`); continue; }
  const inst = JSON.parse(fs.readFileSync(p, "utf8"));
  const div = perSiteDivisor(inst);
  const dof = expectedDof(inst) ?? inst.rows[0]?.dof ?? null;
  const einf = expectedEinf(inst) ?? inst.rows[0]?.einf ?? null;
  // Table V's printed value is this run rounded to its error bar; the duplicate is any row
  // from the paper within one printed sigma of it.
  const dup = inst.rows.find(x => x.bound_type === "variational" && (x.reference || "").includes("2502.17144")
    && Math.abs(x.energy / div - r.energy_per_site) <= Math.max(x.sigma ?? 0, r.std_error * div) / div + 1e-9);
  if (dup) { skipped.push(`${id} ${r.energy_per_site.toFixed(7)} = "${dup.method}" ${dup.energy / div}`); continue; }
  const energy = +(r.energy_per_site * div).toPrecision(12);
  const varTot = +(r.variance_per_site * inst.n_sites ** 2 * 16).toPrecision(8);
  inst.rows.push({
    energy, sigma: +(r.std_error * div).toPrecision(6),
    energy_variance: varTot, dof, einf,
    v_score: vScore(varTot, dof, energy, einf),
    method: METHOD[r.boundary], bound_type: "variational",
    bound_type_reason: "variational ansatz at a stated size; energy is an upper bound (assigned during source reading)",
    reference: REF, peer_reviewed: true,
    source: `repo-data-${CHECKED}`, provenance: "primary",
    verified: {
      checked_on: CHECKED,
      method: "authors' data release read locally (pickle via numpy), values copied by key, no transcription; the file is committed as sources/2502.17144-repo-final_energy_data.json and reproduces the four values Table V prints",
      reported_as: `${r.energy_per_site} +/- ${r.std_error} per site (S.S), Var(E/N) = ${r.variance_per_site}`,
      note: `${SRC.source}: ['${r.boundary}']['rate=${r.rate}']['scale=${r.scale}'], L = ${r.L}; the lowest of the ten training schedules (s = ${r.scale}, r = ${r.rate}). Plotted as a point in Fig. ${r.boundary === "periodic" ? "3(a)" : "12(a)"}, not printed in the paper; Table III prints the zero-variance extrapolation over the s >= 1 runs at this L, carried on this instance as an \`extrapolated\` row. Variance is Var(H)/N^2 in S.S units (see script header); total = var x N^2 x 16.`,
      secondary_of: null,
    },
    compute: COMPUTE[r.boundary],
  });
  added++;
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
}
console.log(`added ${added} repository-data rows (arXiv:2502.17144); ${skipped.length} already on their instance from Table V`);
if (process.env.QMBL_VERBOSE) skipped.forEach(s => console.log("  dup", s));
