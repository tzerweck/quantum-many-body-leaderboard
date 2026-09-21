// Rows from triaging the table matcher's worklist, 2026-09-15: the cells that sat below a
// current record and survived reading the paper. Of 85 such cells, 81 were quoted
// references, extrapolations, lower bounds or the wrong instance; these are the rest.
//
// One of them is a record the matcher could not see. arXiv:2507.10705 prints its lattices
// as "8 × 4", the instance is rectangular-4x8, and the size tokens only ever compared the
// one ordering - so a published energy 0.47% below a VarBench record sat in a cached source
// for two days without being matched.
import fs from "node:fs";

const CHECKED = "2026-09-15";
const PDF = "arXiv PDF text extracted locally with pypdf in layout mode, no LLM transcription";

const HFPS = { ref: "Chen, Wan, Sengupta & Georges, Neural network-augmented Pfaffian wave-functions for scalable simulations of interacting fermions, Proc. Natl. Acad. Sci. U.S.A. 123, e2535288123 (2026), arXiv:2507.10705", pr: true };
const RHB = { ref: "Zhou, Zhou & Liu, Locality-Induced Hierarchical Backflow Wavefunctions for Correlated Fermions, arXiv:2606.00924", pr: false };
const TRF = { ref: "Gu et al., Solving the Hubbard model with neural quantum states, Nat. Commun. 17, 7838 (2026), arXiv:2507.02644, doi:10.1038/s41467-026-74028-6", pr: true };
const HFDS = { ref: "Robledo Moreno, Carleo, Georges & Stokes, Fermionic wave functions from neural-network constrained hidden states, Proc. Natl. Acad. Sci. U.S.A. 119, e2122059119 (2022), arXiv:2111.10420, doi:10.1073/pnas.2122059119", pr: true };
const RVB = { ref: "Closely competing valence bond crystal orders in the ground state of the spin-1/2 antiferromagnetic Heisenberg model on the pyrochlore lattice: a large scale unrestricted variational study, arXiv:2509.13746", pr: false };

const ADD = {
  "Hubbard/rectangular-4x8_32_P_14_8": { fermion: true, rows: [
    { eps: -0.76690, err: 1e-5, varPerSite: 0.016320, m: "HFPS (hidden-fermion Pfaffian state)", bt: "variational", src: HFPS,
      reported: "-0.76690(1) per site, sigma^2/N_site = 0.016320",
      note: 'Table IV of arXiv:2507.10705, "Raw data of Fig. 7 in the L x 4 lattice with 1/8 doping and U = 8", row 8 x 4; Sec. III states Fig. 7 shows "L x 4 PBC lattices". 32 sites, 28 electrons, U = 8, periodic: this instance. The same table\'s 16 x 4 value -0.76413(3) is the HFPS row on rectangular-4x16_64_P_28_8, and its 4 x 4 value -0.74177(5) sits 3e-5 above the ED energy -0.7418 quoted by arXiv:2606.00924. New record, 0.47% below the VarBench HFDS row -0.7633125 and below the RHB -0.7641(3) of arXiv:2606.00924 on the same lattice. Variance: sigma^2/N_site stored as a total (x 32). Its V-score, 2.7e-3, is ~25x the VarBench HFDS row\'s 1.1e-4 at a higher energy; the HFDS variance is the likelier outlier, since on 4x16 the same VarBench ansatz has ten times the per-site variance and this paper puts HFDS 3e-4 above exact already at 4x4. Read from the arXiv version; the PNAS version was not compared (pnas.org refuses this sandbox).' },
    { eps: -0.7641, err: 3e-4, m: "RHB (hierarchical backflow K = 2 + nonlocal FNN factor, Ndet = 5, Nneuron = 100)", bt: "variational", src: RHB,
      reported: "-0.7641 per site, table-wide sampling error ~0.0003",
      note: 'Table IV of arXiv:2606.00924, "Energies per site for the Hubbard model at nh = 0.125, U = 8 for different systems under periodic boundary conditions. The energy sampling errors are around 0.0003", row 4 x 8, column RHB (Ndet = 5, Nneuron = 100, the setting adopted for all large-scale runs after Table III). Instance identity: the same row\'s HFDS column, -0.7633, is the VarBench HFDS row -0.7633125. sigma is the caption\'s table-wide "around 0.0003". Layout mode shifts this row one column left in sweep-tables.tsv; read here from the printed table. Internal check: the same ansatz gives -0.7410 on 4 x 4 against ED -0.7418 (Table III), above exact as it must be.' },
  ]},

  "Hubbard/square_64_P_32_8": { fermion: true, rows: [
    { eps: -0.52582, err: null, m: "Transformer backflow + MARCH optimizer", bt: "variational", src: TRF,
      reported: "-0.52582 per site, no error bar",
      note: 'Supplementary Table S1 of arXiv:2507.02644, "Benchmark energy in pure Hubbard model at half-filling with PBC", column 8 x 8, row "NQS"; the AFQMC reference in the same table is -0.5262(5). Same method string as this paper\'s 16 x 4 row. No error bar, so it is eligible for nothing (RULES.md 6). It sits 1.6e-4 per site below the stored AFQMC exact row -0.5256563(78) - see the defect flag. Read from the arXiv supplement; the Nat. Commun. version was not compared.' },
  ]},

  // VarBench's only row here is the 8x8 energy copied into the 6x6 file (defect
  // `wrong-instance`). This is the number the paper actually gives for 6x6.
  "Hubbard/square_36_PA_18_2": { fermion: true, rows: [
    { eps: -1.2079, err: 1e-4, m: "VMC Hidden Fermion Determinant State Ansatz (N_hidden = 8, fully parametrized hidden sub-matrix, hidden-unit density alpha = 78)", bt: "variational", src: HFDS,
      read: "PNAS supplementary PDF (via Europe PMC, PMC9371695) extracted locally, cross-read against the arXiv version; no LLM transcription",
      reported: "-1.2079(1) per site, no variance",
      note: 'PNAS SI Table 5 (identical to arXiv SI Table V), "Variational energy per site in the L x L Hubbard model at half filling with periodic boundary conditions along one of the sides of the square and anti-periodic boundary conditions along the other side", row L = 6, column U = 2. SI Sec. 6: N_hidden = 8, alpha = 78 for 6x6; no projection or constraint stated, nor what the error bar is. Column alignment checked: the VarBench HFDS rows for 6x6 at U = 4, 6, 8 and 8x8 at U = 2, 4, 8 match the printed digits. As a total, -43.4844 sits 3.4e-4 (relative) above the sign-free AFQMC value -43.499(2) for this lattice (Qin, Shi & Zhang, PRB 94, 085103 (2016), Table IV, PBC-APBC) and above the non-interacting bound -59.712813.' },
  ]},

  // VarBench's only row here sits 25 sigma below sign-free AFQMC (defect `below-exact`).
  "Hubbard/square_64_PA_32_6": { fermion: true, rows: [
    { eps: -0.6574, err: 2e-4, m: "VMC Hidden Fermion Determinant State Ansatz (N_hidden = 16, fully parametrized hidden sub-matrix, hidden-unit density alpha = 1)", bt: "variational", src: HFDS,
      read: "PNAS supplementary PDF (via Europe PMC, PMC9371695) extracted locally, cross-read against the arXiv version; no LLM transcription",
      reported: "-0.6574(2) per site, no variance",
      note: 'PNAS SI Table 5 (identical to arXiv SI Table V), "Variational energy per site in the L x L Hubbard model at half filling with periodic boundary conditions along one of the sides of the square and anti-periodic boundary conditions along the other side", row L = 8, column U = 6. SI Sec. 6: N_hidden = 16, alpha = 1 for 8x8, the settings in the VarBench method string. Column alignment checked as for square_36_PA_18_2. As a total, -42.0736 sits 2.3e-3 (relative) above the sign-free AFQMC value -42.17(2) for this lattice (Qin, Shi & Zhang, PRB 94, 085103 (2016), Table IV, PBC-APBC), as a variational energy must, and fits the paper\'s size trend at U = 6 (-0.68135, -0.6609, -0.6574 for L = 4, 6, 8).' },
  ]},

  "Heisenberg/pyrochlore-4x4x4_256_P": { rows: [
    // Energy corrected 2026-09-19 to the authors' own measurement of the fixed optimized state
    // (Rong Cheng, private correspondence; outputs in sources/2509.13746-authors-*), RULES.md 11:
    // the paper prints "~ -0.4855", the measurement is -0.4855840(29), one unit of the last printed
    // digit below it. The printed value stays on the row in `corrections`; sigma and the variance
    // come from the same files through error-metrics-2026-09-19.json.
    { eps: -0.48558404568894675, err: null, m: "Generalized RVB ansatz, unrestricted VMC optimization (no quantum-number projection)", bt: "variational", src: RVB,
      reported: "E0 ~ -0.4855 J/site, approximate, no error bar",
      corrections: [{
        field: "energy", to: +((-0.48558404568894675 * 1024).toPrecision(12)),
        reported_as: "energy_total_J =  -1.2430951569637037E+002 | energy_per_site_J =  -4.8558404568894675E-001",
        location: "sources/2509.13746-authors-pyro-result.dat, the authors' dedicated Monte Carlo measurement of the optimized L = 4 state (Rong Cheng, 2026-09-19; README in sources/2509.13746-authors-README_QMBL.txt)",
        version_read: "private correspondence, data files as received 2026-09-19 (zip sha256 da066f4b244e886c82bf347a2b5e43cecd0e12369ccfa240b809170c71b79dcc)",
        conversion: "S.S total x 4 = Pauli total; per site -0.48558404568894675 x 1024",
        checked_on: "2026-09-19",
        reason: "The paper gives the energy as approximate to four decimals; the authors measured the same fixed state with 8,388,608 samples over 256 chains and obtained E/N = -0.4855840(29) J, one unit of the last printed digit below the printed value and 29 sigma of the new error bar, so a sigma cannot sit on the printed number. Corrected to the measured value with the printed one kept here (ruling 2026-09-19, Tristan).",
        source_entry: "qmbl-runs/repo-data-census/search/replies/2509.13746-cheng-2026-09-19.txt, ruling 1 (2026-09-19)",
        from: +((-0.4855 * 1024).toPrecision(12)),
      }],
      note: 'Sec. A: "The obtained ground state energy is E0 ~ -0.5118 J/site for the L = 2 cluster and E0 ~ -0.4855 J/site for the L = 4 cluster", periodic boundary conditions on both; the L = 4 cluster carries Nv = 4N^2 = 262144 parameters, so N = 256. Units: the same passage quotes the mVMC energy -0.5162 J/site for L = 2, which is the pyrochlore-2x2x2_32_P record -0.516266 in the S.S per-site convention. Approximate and without an error bar, so it is eligible for nothing (RULES.md 6). It is nonetheless 0.5% below the VarBench mVMC record -0.4830957, although the ansatz has no symmetry projection and sits above mVMC at L = 2 - which says more about that record than about this row. 2026-09-19: the authors measured the fixed state on request, E/N = -0.4855840(29) J with Var(H) = 4.894(22) J^2 (see corrections and error_metrics on this row); with a sigma it is eligible and holds the variational record on this instance.' },
  ]},
};

let added = 0;
for (const [id, spec] of Object.entries(ADD)) {
  const p = `data/${id}.json`;
  const inst = JSON.parse(fs.readFileSync(p, "utf8"));
  const { dof, einf } = inst.rows[0];
  // fermions are stored as totals of the per-site energy; spins as Pauli totals, 4N x S.S
  const f = spec.fermion ? inst.n_sites : 4 * inst.n_sites;
  for (const r of spec.rows) {
    const energy = +(r.eps * f).toPrecision(12);
    const varTot = r.varPerSite == null ? null : +(r.varPerSite * inst.n_sites * (spec.fermion ? 1 : 16)).toPrecision(8);
    inst.rows.push({
      energy, sigma: r.err == null ? null : +(r.err * f).toPrecision(6),
      energy_variance: varTot, dof, einf,
      v_score: varTot == null ? null : (dof * varTot) / (energy - einf) ** 2,
      method: r.m, bound_type: r.bt,
      bound_type_reason: "variational ansatz; energy is a strict upper bound (assigned during source verification)",
      reference: r.src.ref, peer_reviewed: r.src.pr,
      source: "sweep-worklist-2026-09-15", provenance: "primary",
      verified: { checked_on: CHECKED, method: r.read ?? PDF, reported_as: r.reported, note: r.note, secondary_of: null },
      ...(r.corrections ? { corrections: r.corrections } : {}),
    });
    added++;
  }
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
}
console.log(`added ${added} worklist rows`);
