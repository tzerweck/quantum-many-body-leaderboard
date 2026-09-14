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
    finding:"Claims E/N = -0.5001, below RBM+PP's -0.4989635, while reporting a variance that gives a V-score of 5.6e-3 to 1.4e-2 against RBM+PP's 9.81e-4 - 6x to 14x worse. A state further from an eigenstate cannot also be lower in energy: by the V-score calibration (rel. err ~ V/63) this energy should sit ~1.2e-3 ABOVE where it is reported. The inconsistency is internal to the paper's own E and Var and needs no external reference." },
);

export const SHARED = {
  "energy-variance-inconsistent": {
    diagnosis: "The reported energy is inconsistent with the paper's OWN reported variance. At 8x8 the claimed E/N = -0.5001 beats RBM+PP's -0.4989635 while the reported variance gives a V-score 6x-14x worse (5.6e-3 to 1.4e-2 vs 9.81e-4). Energy and variance move together - a state further from an eigenstate cannot be lower in energy - so by the V-score calibration this energy should be ~1.2e-3 higher than claimed.",
    ruled_out: "NOT 'below the exact ground state'. There is no exact reference at 8x8 or 10x10: ED for this model reaches about 6x6, and the paper correctly uses 6x6 ED (-0.5038) as its only exact anchor. Chen & Heyl's -0.497715(9) is a zero-variance extrapolation, not a bound, so a lower variational energy would only mean the extrapolation carries systematic error. Robust to the ambiguity in how the paper defines sigma^2: both readings leave the variance far worse than the field's.",
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
