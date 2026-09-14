// Hubbard rows from arXiv:2510.11710 (Phys. Rev. B 113, 245104), Table 1.
//
// A comparison paper, which is why it is worth the trouble: it reports six ansaetze on
// one instance under identical conditions, WITH the energy variance for each. Almost
// nobody publishes Var(E) since 2024, so these rows arrive V-score-computable - the
// thing the outreach plan was going to have to beg checkpoints for.
//
// Instance identity (RULES.md 2): the paper states U/t = 8 and n_h = 1/8 hole doping.
// QMBL's square_64_P_28_8 is 64 sites with Nf = 28 per spin, i.e. 56 electrons,
// n = 0.875, delta = 1/8, periodic - the 8x8 TORUS rows, not the cylinder ones.
// The 8x4 rows are cylinders and map to rectangular-4x8_32_PO_14_8.
import fs from "node:fs";

const CHECKED = "2026-09-14";
const SRC = { ref: "Comparing Symmetrized Determinant Neural Quantum States for the Hubbard Model, Phys. Rev. B 113, 245104 (2026), arXiv:2510.11710", pr: true };
const T1 = "Read from Table 1 of arXiv:2510.11710 (U/t = 8, n_h = 1/8, energies per site, 131072 samples), parsed from the arXiv HTML.";

// eps = E_0/M, varPerSite = sigma^2/M, both exactly as printed in Table 1.
const ADD = {
  "Hubbard/square_64_P_28_8": { rows: [
    { eps: -0.7458, err: 6e-4, varPerSite: 0.0525, m: "Jastrow-backflow (JBf), 8x8 torus", note: T1 + ' Row "JBf (8x8 Torus)".' },
    { eps: -0.7454, err: 9e-4, varPerSite: 0.0563, m: "Hidden-fermion determinant state (HFDS), 8x8 torus", note: T1 + ' Row "HFDS (8x8 Torus)".' },
    { eps: -0.7422, err: 3e-4, varPerSite: 0.0698, m: "JBf-ViT (vision transformer backflow), 8x8 torus", note: T1 + ' Right-hand table, row "JBf-ViT"; same lattice and parameters per the caption.' },
    { eps: -0.736,  err: 1e-3, varPerSite: 0.105,  m: "HFDS-ViT, 8x8 torus", note: T1 + ' Right-hand table, row "HFDS-ViT".' },
    { eps: -0.729,  err: 4e-3, varPerSite: 0.139,  m: "HFDS Symm-ViT-Ti, 8x8 torus", note: T1 + ' Right-hand table, row "HFDS Symm-ViT-Ti".' },
    { eps: -0.726,  err: 9e-3, varPerSite: 0.168,  m: "JBf Symm-ViT-Ti, 8x8 torus", note: T1 + ' Right-hand table, row "JBf Symm-ViT-Ti".' },
  ]},
  // 8x4 cylinder: no record here - the instance already carries a DMRG energy at
  // -0.736391, below this paper's own DMRG cross-check - but JBf is a new ansatz on it.
  "Hubbard/rectangular-4x8_32_PO_14_8": { rows: [
    { eps: -0.73342, err: 8e-5, varPerSite: 0.0225, m: "Hidden-fermion determinant state (HFDS), 8x4 cylinder", note: T1 + ' Row "HFDS (8x4)".' },
    { eps: -0.7332,  err: 6e-4, varPerSite: 0.0235, m: "Jastrow-backflow (JBf), 8x4 cylinder", note: T1 + ' Row "JBf (8x4)".' },
  ]},
};

let added = 0;
for (const [id, spec] of Object.entries(ADD)) {
  const p = `data/${id}.json`;
  const inst = JSON.parse(fs.readFileSync(p, "utf8"));
  const { dof, einf } = inst.rows[0];
  const N = inst.n_sites;                     // Hubbard: stored as totals, papers per site
  for (const r of spec.rows) {
    const energy = +(r.eps * N).toPrecision(12);
    // Var(E) is extensive, so the total variance is the per-site value times N.
    const varTot = +(r.varPerSite * N).toPrecision(8);
    inst.rows.push({
      energy, sigma: +(r.err * N).toPrecision(6),
      energy_variance: varTot, dof, einf,
      v_score: (dof * varTot) / (energy - einf) ** 2,
      method: r.m,
      bound_type: "variational",
      bound_type_reason: "variational ansatz; energy is a strict upper bound (assigned during source verification)",
      reference: SRC.ref, peer_reviewed: SRC.pr,
      source: "sweep-tables-2026-09-14", provenance: "primary",
      verified: {
        checked_on: CHECKED,
        method: "arXiv HTML parsed locally, no LLM transcription",
        reported_as: `E_0/M = ${r.eps} (+/- ${r.err}), sigma^2/M = ${r.varPerSite}`,
        note: r.note, secondary_of: null,
      },
    });
    added++;
  }
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
}
console.log(`added ${added} Hubbard rows with variances from arXiv:2510.11710`);
