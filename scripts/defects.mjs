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
    flag:"below-established-ground-state",
    finding:"-0.49782(3) is 1.05e-4 below the best zero-variance extrapolated ground state, -0.497715(9), and 1.3e-4 below the best variational energy. The paper calls it 'statistically consistent with the variational state of the art'; it is lower by ~4 sigma of its own error bar." },
  { match:{instance:"J1J2/square_64_P_0.5", method:"Holographic Quantum Transformer (HQT)"},
    flag:"below-established-ground-state",
    finding:"-0.5001(1) is 1.1e-3 below the best known variational energy for 8x8 J2=0.5 (RBM+PP, -0.4989635), on a well-studied instance. Same direction as the same paper's 10x10 claim, so a systematic error rather than a fluctuation." },
);

export const SHARED = {
  "below-established-ground-state": {
    diagnosis: "Below the established ground state on two independent instances, in the same direction. Not auto-detectable by scripts/validate.mjs: neither 8x8 nor 10x10 J1-J2 has an exact reference row, so the variational-principle check has nothing to fire against. Caught by comparing against the best published values instead.",
    ruled_out: "Not a convention mismatch: the paper compares its number directly against Chen & Heyl's -0.4976921(4), so it intends the same units.",
    evidence: "arXiv:2607.00398 abstract and Sec. 1; comparison rows in this instance.",
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
