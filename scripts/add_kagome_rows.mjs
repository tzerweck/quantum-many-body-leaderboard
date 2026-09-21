// Kagome rows from Ðurić, Chung, Yang & Sengupta (Phys. Rev. X 15, 011047 (2025),
// arXiv:2401.02866) and Depenbrock, McCulloch & Schollwöck (Phys. Rev. Lett. 109,
// 067201 (2012), arXiv:1205.4858), both fetched as PDF.
//
// This opens the instance the whole project exists to host: a 108-site kagome cluster
// where the lowest published energy is contested on the record. Ðurić et al. report a
// spinon pair-density-wave ground state at E0 = -48.18, 1.78% below the DMRG benchmark
// E = -47.33964 they compare against. arXiv:2605.28861 (Kamal, Kufel, Vu, Laumann &
// Yao) shows that number is an artifact of non-ergodic sampling. Both rows are carried;
// the flag decides what can hold the record, not deletion (RULES.md 11).
//
// Two bound_type calls here are doing real work:
//
//   * The DMRG rows are `extrapolated`, NOT `variational`. Depenbrock et al. state that
//     their energies are "extrapolated in the truncation error of single-site DMRG".
//     An extrapolation to zero truncation error lies below any energy an MPS actually
//     achieved, so it is not a strict variational bound (RULES.md 4). This is the
//     difference between DMRG at a *stated bond dimension*, which is a bound, and DMRG
//     extrapolated in the truncation error, which is not.
//   * Consequently the 108-site instance has NO eligible record: its only variational
//     row is flagged and its only other row is an extrapolation. That is the correct
//     answer, and it is one a leaderboard ranking on energy alone could not give.
import fs from "node:fs";

const CHECKED = "2026-09-14";
const DURIC = { ref: "Ðurić, Chung, Yang & Sengupta, Spin-1/2 Kagome Heisenberg Antiferromagnet: Machine Learning Discovery of the Spinon Pair-Density-Wave Ground State, Phys. Rev. X 15, 011047 (2025), arXiv:2401.02866", pr: true };
const DEPEN = { ref: "Depenbrock, McCulloch & Schollwoeck, Nature of the Spin Liquid Ground State of the S=1/2 Heisenberg Model on the Kagome Lattice, Phys. Rev. Lett. 109, 067201 (2012), arXiv:1205.4858", pr: true };

const ADD = {
  // ---- 48 sites (4x4x3), PBC. The Comment's objection does NOT reach this cluster:
  // Ðurić et al. use the ergodic spin-exchange update at the smaller sizes, and it is
  // only the 108-site run that switches to single spin flips.
  "Heisenberg/kagome-4x4_48_P": { rows: [
    { eps: -21.00 / 48, err: 0.01 / 48, m: "GCNN (6 layers, 6 feature maps), symmetric ansatz", bt: "variational",
      src: DURIC,
      note: 'Sec. III: "R = (E_GCNN - E_ED)/E_ED ~ 0.3% with E_ED = -21.057787063 and E_GCNN = -21.00 +/- 0.01" on the 48-site (4x4x3) PBC cluster, chi0 sector. Total energy in S.S units; E/N = -0.4375. The instance\'s existing exact row is -0.4387039, i.e. -21.057787063/48 to 8 digits, which confirms the cluster and the convention. Sampling here is the ergodic spin-exchange update, so the objection in arXiv:2605.28861 does not apply to this size.' },
    { eps: -0.4383, err: 2e-4, m: "DMRG, truncation-error extrapolated (Torus 4)", bt: "extrapolated",
      src: DEPEN,
      note: 'Table I row "Torus 4 -0.4383(2)". The paper states energies are "extrapolated in the truncation error of single-site DMRG", so this is not a strict variational bound (RULES.md 4). Sits above the exact -0.4387039 on this instance.' },
  ]},

  // ---- 108 sites (6x6x3), PBC. New instance.
  "Heisenberg/kagome-6x6_108_P": {
    create: { model: "Heisenberg", lattice: "kagome-6x6", n_sites: 108, boundary: "P", params: {}, dof: 108, einf: 0 },
    rows: [
      { eps: -48.18 / 108, err: null, m: "GCNN, spinon pair-density-wave state (chi0, P_Z2 = -1, q = (pi, pi/sqrt3))", bt: "variational",
        src: DURIC,
        note: 'Sec. III (end of the 108-site paragraph) and Fig. 5 caption: "The obtained ground state energy E0 = -48.18(0) is ~1.78% lower than the ground state energy obtained with DMRG calculations (E_DMRG = -47.33964)"; same value in arXiv v1 (Fig. 12 caption, "E_chi0 = -48.18(0)"). Total in S.S units; E/N = -0.4461111. The only error statement is the parenthesised (0): a statistical error that rounds to zero at the 0.01 level, while the other five 108-site states in the same figure carry (3)-(8). No variance, acceptance rate or autocorrelation time is printed in either version. A near-zero error bar from 2^13 samples of a non-eigenstate is itself a symptom of frozen Markov chains, so no sigma is recorded. Sampler stated by the paper: single spin flips over the whole Hilbert space, no S^z_tot = 0 sector (Sec. III end). DISPUTED - see the defect flag.' },
      { eps: -0.4383, err: 3e-4, m: "DMRG, truncation-error extrapolated (Torus 6)", bt: "extrapolated",
        src: DEPEN,
        note: 'Table I row "Torus 6 -0.4383(3)", the 108-site torus ("we also consider tori of up to 108 sites"). E/N x 108 = -47.336, consistent with the -47.33964 that Ðurić et al. quote as the DMRG benchmark. Extrapolated in the truncation error, so not a strict bound (RULES.md 4).' },
    ]},
};

let added = 0, created = 0;
for (const [id, spec] of Object.entries(ADD)) {
  const p = `data/${id}.json`;
  const exists = fs.existsSync(p);
  const inst = exists ? JSON.parse(fs.readFileSync(p, "utf8")) : { ...spec.create, instance_id: id, rows: [] };
  if (!exists) { delete inst.dof; delete inst.einf; created++; }
  const r0 = inst.rows[0];
  const dof = r0 ? r0.dof : spec.create.dof;
  const einf = r0 ? r0.einf : spec.create.einf;
  const f = 4 * inst.n_sites;

  for (const r of spec.rows) {
    inst.rows.push({
      energy: +(r.eps * f).toPrecision(12),
      sigma: r.err == null ? null : +(r.err * f).toPrecision(6),
      energy_variance: null, dof, einf, v_score: null,
      method: r.m, bound_type: r.bt,
      bound_type_reason: "assigned during source verification (RULES.md 4)",
      reference: r.src.ref, peer_reviewed: r.src.pr,
      source: "sweep-pdf-2026-09-14", provenance: "primary",
      verified: {
        checked_on: CHECKED,
        method: "arXiv PDF text extracted locally with pypdf, no LLM transcription",
        reported_as: `${r.eps} per site in S.S units`,
        note: r.note, secondary_of: null,
      },
    });
    added++;
  }
  fs.mkdirSync(`data/${id.split("/")[0]}`, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
}
console.log(`added ${added} kagome rows (${created} new instance)`);
