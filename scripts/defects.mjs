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
    finding:"Claims E/N = -0.5001, below RBM+PP's -0.4989635, while reporting a variance that gives a V-score of 5.6e-3 against RBM+PP's 9.81e-4 - 5.7x worse. A state further from an eigenstate cannot also be lower in energy: by the V-score calibration (rel. err ~ V/63) this energy should sit ~1.2e-3 ABOVE where it is reported. The inconsistency is internal to the paper's own E and Var and needs no external reference." },
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
