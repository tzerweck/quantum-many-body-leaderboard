// Known defects in imported rows. Rows are never silently corrected or deleted
// (RULES.md §11): the defect is attached to the row and travels with it.
export const DEFECTS = [
  {
    match: { instance: "TFIsing/chain_10_P_1", method: "RBM (alpha = 1)", energy: -12.785231 },
    flag: "below-exact",
    finding: "6.8 sigma below the exact ground state, which no variational state can be. Settled by rerun on 2026-09-11 (checks/results-tfising-rbm.json).",
  },
  {
    match: { instance: "TFIsing/chain_10_O_1", method: "RBM (alpha = 1)", energy: -12.381718 },
    flag: "below-exact",
    finding: "10.4 sigma below the exact ground state. Same cause as chain_10_P_1.",
  },
  {
    match: { instance: "TFIsing/chain_32_P_0.5", method: "RBM (alpha = 1)", energy: -34.033633 },
    flag: "below-exact-suspected",
    finding: "3.8 sigma below the exact solution, same method string and same signature as the two 10-site rows. Not directly reproduced: 32 sites cannot be summed exactly, so the full-summation argument does not apply here.",
  },
  {
    match: { instance: "Heisenberg/square_196_P", method: "DMRG (bond dimension = 512)" },
    flag: "dof-mismatch", finding: "Row stores dof = 100 on a 196-site instance. Upstream typo; the V-score derived from it would be wrong by a factor of ~2.",
  },
  {
    match: { instance: "Heisenberg/triangular_144_P", method: "DMRG (bond dimension = 512)" },
    flag: "dof-mismatch", finding: "Row stores dof = 100 on a 144-site instance. Same typo.",
  },
];

DEFECTS.push(
  { match:{instance:"J1J2/square_100_P_0.5", method:"Holographic Quantum Transformer (HQT), zero-shot 8x8->10x10 transfer"},
    flag:"energy-variance-inconsistent",
    finding:"Claimed 1.3e-4 below the best variational energy (CNN-MPS) while the paper itself calls the number 'statistically consistent with the variational state of the art' - it is lower by ~4x its own stated error bar, so if real it is an unclaimed record. There is NO exact reference at 10x10 (ED reaches ~6x6 for this model), so this is a contested record claim, not a proven error." },
  { match:{instance:"J1J2/square_64_P_0.5", method:"Holographic Quantum Transformer (HQT)"},
    flag:"energy-variance-inconsistent",
    finding:"Claims E/N = -0.5001, below RBM+PP's -0.4989635, while reporting a variance that gives a V-score of 5.6e-3 against RBM+PP's 9.81e-4 - 5.7x worse. Taken at face value a state further from an eigenstate should not be lower in energy: by the V-score calibration (rel. err ~ V/63) this energy would sit ~1.2e-3 ABOVE where it is reported. That is grounds for objection, not proof of error. The inference assumes the lower-variance competitor sits near the ground state; a state pinned near a competing, excited configuration can have a small variance and a large energy error (RULES.md 9, the HFDS stripe case). Nothing suggests RBM+PP is such a state here, but the variance alone cannot rule it out." },
);

DEFECTS.push(
  { match: { instance: "Heisenberg/kagome-6x6_108_P", method: "GCNN, spinon pair-density-wave state (chi0, P_Z2 = -1, q = (pi, pi/sqrt3))" },
    flag: "sampling-nonergodic",
    finding: "Published in Phys. Rev. X 15, 011047 (2025) as a ground state 1.78% below the DMRG benchmark. A Comment (arXiv:2605.28861) shows the single-spin-flip update used at this size does not conserve total magnetisation, so the Markov chains freeze and the low energy is a sampling artifact. Under ergodic sampling the same ansatz converges ~3.5% ABOVE DMRG." },
);

DEFECTS.push(
  { match: { instance: "Hubbard/square_64_P_32_8", method: "Transformer backflow + MARCH optimizer" },
    flag: "below-exact-suspected",
    finding: "Reported without an error bar at E/N = -0.52582, 1.6e-4 per site below the stored AFQMC exact row -0.5256563(78): 2.1 sigma of the AFQMC error alone. Not established - the paper's own AFQMC reference for this lattice is -0.5262(5), lower still, and the NQS error is unknown - but a variational energy below a numerically exact one is grounds for objection (RULES.md 10). It holds nothing either way: a sampled energy with no sigma is eligible for nothing (RULES.md 6)." },
  { match: { instance: "Hubbard/square_64_PA_32_6", method: "VMC Hidden Fermion Determinant State Ansatz (N_hidden = 16. Single hidden layer fully connected net with alpha = 1). Soft mean-field constraint for Neel order." },
    flag: "below-exact",
    finding: "VarBench stores -42.676 (E/N = -0.666813) and cites the HFDS paper, Moreno et al., PNAS 119, e2122059119 (2022). The paper gives -0.6574(2) for this lattice (8x8, half filling, U = 6, periodic along one side and antiperiodic along the other) in both the PNAS supplement (Table 5, read via Europe PMC PMC9371695) and the arXiv version (SI Table V). The stored number also sits 0.5 below the sign-free AFQMC total for this lattice, -42.17(2) (Qin, Shi & Zhang, PRB 94, 085103 (2016), Table IV) - 1.2%, about 25 sigma - which no variational energy can do. It breaks the paper's own size trend at U = 6 as well (-0.68135, -0.6609, -0.6574 for L = 4, 6, 8)." },
  { match: { instance: "Hubbard/square_36_PA_18_2", method: "VMC Hidden Fermion Determinant State Ansatz (N_hidden = 16. Single hidden layer fully connected net with alpha = 1). Soft mean-field constraint for Neel order.", energy: -76.162 },
    flag: "wrong-instance",
    finding: "Energy, sigma and variance (-76.162, 0.006, 0.14(2)) are identical to the 8x8 row on square_64_PA_32_2. The HFDS first author uploaded them to the 6x6 file 67 minutes after the 8x8 file (VarBench commits c810bdcd22, then 21f00e54f6), and they never changed. -76.162 / 64 = -1.19003 is the paper's 8x8, U = 2 value, -1.1900(2) (PNAS SI Table 5, arXiv SI Table V). As a 36-site total it is -2.1156 per site: 16.45 below the non-interacting ground state of this lattice, -59.712813, which a U >= 0 Hamiltonian cannot go below, and 32.7 below the sign-free AFQMC total -43.499(2) (Qin, Shi & Zhang, PRB 94, 085103 (2016), Table IV). The paper's 6x6 value, -1.2079(1), is carried as a separate row." },
);

export const SHARED = {
  "sampling-nonergodic": {
    diagnosis:
      "The reported energy is an artifact of non-ergodic Monte Carlo sampling, not a property of the ansatz. " +
      "The kagome Heisenberg Hamiltonian is SU(2) symmetric and its ground state lies in a fixed total-magnetisation " +
      "sector, so a single-spin-flip update - which changes S^z_tot - is incompatible with the symmetry. As the network " +
      "concentrates on the physical S^z_tot = 0 sector the acceptance rate collapses to exactly zero beyond 5000 " +
      "iterations and the chains freeze, so the reported average is taken over a non-representative set of configurations. " +
      "With the magnetisation-preserving exchange update the same architecture and optimizer converge stably to " +
      "E ~ -45.6 against a DMRG value of E ~ -47.3; re-evaluating the spin-flip-optimised PARAMETERS under ergodic " +
      "sampling raises the energy further, to E ~ -42.6. The published -48.18 lies below all of them.",
    ruled_out:
      "NOT a variational-principle violation, and that is the point: DMRG at finite bond dimension is itself an upper " +
      "bound, so an energy below it is not on its own evidence of error - it would ordinarily just be a better state. " +
      "Nothing about the number alone identifies it as wrong. The refutation had to come from the sampler.",
    evidence: "arXiv:2605.28861 (Kamal, Kufel, Vu, Laumann & Yao), Fig. 1(a) acceptance-rate collapse and Fig. 1(b) energy convergence; Ðurić et al., Phys. Rev. X 15, 011047 (2025), arXiv:2401.02866, Sec. IV.",
  },
  "energy-variance-inconsistent": {
    diagnosis: "The reported energy is inconsistent with the paper's OWN reported variance. At 8x8 the claimed E/N = -0.5001 beats RBM+PP's -0.4989635 while the reported variance (sigma^2 = 1.4e-3 per site, S.S units) gives a V-score of 5.6e-3 against RBM+PP's 9.81e-4 - 5.7x worse. Energy and variance move together - a state further from an eigenstate cannot be lower in energy - so by the V-score calibration this energy should be ~1.2e-3 higher than claimed.",
    ruled_out: "NOT 'below the exact ground state'. There is no exact reference at 8x8 or 10x10: ED for this model reaches about 6x6, and the paper correctly uses 6x6 ED (-0.5038) as its only exact anchor. Chen & Heyl's -0.497715(9) is a zero-variance extrapolation, not a bound, so a lower variational energy would only mean the extrapolation carries systematic error. The sigma^2 is per site, so the V-score is 5.6e-3 and not a range. Separately, the paper is internally inconsistent about it: Table 1 gives sigma^2 = 1.4e-3 for the 8x8 run while the J2 scan lists 0.0034 at J2 = 0.50, which would make the V-score 1.4e-2 and the contradiction larger. No variance is reported at 10x10 at all, so that row's flag rests only on it being an unclaimed record.",
    evidence: "arXiv:2607.00398 Tables 1-3; V-scores recomputed from this instance's own rows.",
  },
  "below-exact": {
    diagnosis:
      "The published value is a minimum of the optimization trace, not a converged measurement. " +
      "Three seeds each, netket 3.22.4, alpha=1 complex RBM, 2000 SR steps. Evaluating the trained " +
      "parameters by FULL SUMMATION over all 1024 basis states (zero Monte-Carlo error) puts every " +
      "converged energy ABOVE the exact value, as the variational principle requires, while every " +
      "training trace dips 1.5e-3 to 3.5e-3 BELOW it. Each published value lies between the two.",
    ruled_out:
      "Not an autocorrelation-underestimated error bar: tau_corr <= 0.05 and R_hat = 1.0000 across all six runs.",
    evidence: "checks/results-tfising-rbm.json, checks/tfising_rbm_check.py",
  },
};

// All-results pass, 2026-09-15: two finite-PEPS energies on the 6x6 open cluster that sit
// below its exact ground state. Carried as published, flagged so neither can hold the record.
DEFECTS.push(
  { match: { instance: "Heisenberg/square_36_O", method: "PEPS, gradient optimization (GO) after SU initialization, D=8, Dc=16 (finite, open-boundary 6x6 cluster)", energy: -86.907312 },
    flag: "below-exact",
    finding: "Monte-Carlo estimate over a PEPS contracted at a truncated bond dimension (Dc = 2D); the quoted error is sampling only, and Appendix A of the paper puts the contraction systematic at ~8e-6 absolute at D = 8 on 10x10, the same order as the dip below the exact 6x6 energy. Not a strict variational bound as printed. arXiv:1611.09467 Table II, reported -0.603523(1) per site against the exact -0.6035218345." },
  { match: { instance: "Heisenberg/square_36_O", method: "PEPS, gradient optimization (GO) after SU initialization, D=10, Dc=20 (finite, open-boundary 6x6 cluster)", energy: -86.90904 },
    flag: "below-exact",
    finding: "Monte-Carlo estimate over a PEPS contracted at a truncated bond dimension (Dc = 2D); the quoted error is sampling only, and Appendix A of the paper puts the contraction systematic at ~8e-6 absolute at D = 8 on 10x10, the same order as the dip below the exact 6x6 energy. Not a strict variational bound as printed. arXiv:1611.09467 Table II, reported -0.603535(1) per site against the exact -0.6035218345." },
);

// arXiv:2605.13807's own exact column reproduces this instance's exact row to seven digits,
// and its 1D LRU energy sits below it (SWEEP.md, "a variational energy below its own exact
// column"). Carried as published now that the all-results pass takes every row.
DEFECTS.push(
  { match: { instance: "TFIsing/chain_10_O_1", method: "1D LRU (linear recurrent unit) NQS, iterative retraining from cold start" },
    flag: "below-exact",
    finding: "E/N = -1.2381549(7) against the exact -1.2381490 printed in the same table (Table I, N = 10), about 8 sigma below. An independent matrix-free Lanczos ED (checks/tfim_obc_ed.mjs) reproduces the paper's exact column at N = 6-16, so the columns are read correctly; the inversion is in the published numbers. Same instance and same class of error as the VarBench RBM (alpha = 1) row." },
);

// arXiv:2607.00398 on the 8x8 Heisenberg torus: an energy with no error bar below the SSE
// QMC ground state. Same paper as the two energy-variance-inconsistent J1-J2 rows above.
DEFECTS.push(
  { match: { instance: "Heisenberg/square_64_P", method: "HQT (Ours)" },
    flag: "below-exact",
    finding: "E/N = -0.6735 printed without an error bar, 1.3e-5 per site below the stochastic-series-expansion ground state carried on this instance. With no sigma the gap cannot be read as sampling noise." },
);
// Moss et al., Phys. Rev. B 112, 134450 (arXiv:2502.17144), Table III: the zero-variance
// energies on the periodic square lattice. qmbl-verify 2026-09-17 read the authors' notebook
// (sources/2502.17144-repo-get_zer_var_energies.ipynb): the printed bar is the spread of the
// 1000 bootstrap intercepts divided by sqrt(1000), the standard error of their mean, which
// shrinks with more resamples and is not the uncertainty of the extrapolated energy. The
// spread itself is about 30x larger. The rows keep the printed bar (Tristan, 2026-09-18) and
// are flagged; the authors have been asked which bar they intend.
{
  const M = "2D RNN wavefunction, zero-variance extrapolation";
  // L, energy, printed sigma per site, bootstrap spread per site, printed / spread sigma below SSE
  const ROWS = [
    [8, -172.4172032, "2e-7", "6.6e-6", "73", "2.2"],
    [10, -268.638, "5e-7", "1.5e-5", "85", "2.9"],
    [12, -386.3236608, "1e-7", "3.6e-6", "185", "5.2"],
    [14, -525.5224128, "5e-7", "1.5e-5", "154", "5.0"],
    [20, -1071.5872, "6e-7", "1.5e-5", "37", "1.5"],
    [24, -1542.7876608, "5e-7", "1.6e-5", "17", "0.5"],
    [28, -2099.733888, "4e-7", "1.3e-5", "33", "1.0"],
  ];
  for (const [L, energy, printed, spread, sigP, sigB] of ROWS) DEFECTS.push({
    match: { instance: `Heisenberg/square_${L * L}_P`, method: M, energy },
    flag: "sigma-understated",
    finding: `The printed bar, ${printed} per site, is the standard error of the mean of 1000 bootstrap refits (authors' notebook, cell 13), not the spread of the refits, ${spread} per site. Against Sandvik's SSE energy on this instance the row sits ${sigP} printed sigma below, ${sigB} of the bootstrap spread below.`,
  });
}

// qmbl-verify 2026-09-18 (RA1), ruling 2a (Tristan, 2026-09-19): the row stays exact (the method is) and
// the flag keeps it off the record; DMRG holds it.
DEFECTS.push(
  { match: { instance: "tV/square_64_P_32_4", method: "QMC (continuous-time expansion)", energy: -9.7906046108775 },
    flag: "exact-above-variational-bound",
    finding: "Stored -9.7906 +- 0.166 sits 0.458 ABOVE the variational DMRG row -10.2486 (2.76 sigma) and 0.430 above Hartree-Fock (2.59 sigma), which an unbiased ground-state estimate can only do by fluctuation. The committed h5 is a second run of the same estimator: -10.0373 +- 0.1194, again 1.77 sigma above DMRG; the two runs combined, -9.953 +- 0.097, are 3.05 sigma above. On that h5 the vertex-count estimator (KinE + IntE2, error 20x smaller) gives -10.2491 +- 0.0069, 0.08 sigma from DMRG: the projection and the sign are fine and E0 is about -10.249; it is the single-random-site Wick Energy estimator whose error bar is understated at V = 4 (per-measurement variance 1096, binning reports no autocorrelation where the vertex observables show tau = 137). Below the 3 sigma of RULES.md 9.4, so not a validator issue; held off the record at its stated sigma." },
);
