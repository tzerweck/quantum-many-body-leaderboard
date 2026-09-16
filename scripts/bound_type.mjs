// bound_type classifier for VarBench method strings. First match wins; order is load-bearing.
export const RULES = [
  // 0. Explicitly disclaimed by VarBench itself as not a strict upper bound
  [/no strict upper bound|constraint release/i, "projected"],
  // 1. Projector / constrained methods: bound only within a constraint, or biased.
  //    NOTE: p-step Lanczos is deliberately NOT here - it is a strict variational upper bound.
  [/fixed[- ]node|^fn\b|\bfn on the state\b|\bcp[- ]afqmc\b|constrained[- ]path|\bgfmc\b|green'?s function monte carlo|\bpower method\b/i, "projected"],
  // 2. Variational circuits BEFORE the exact rule: "exact grad" / "exact grads & metric"
  //    describes how the gradient was computed, not the energy. 21 VQE rows depend on this.
  [/\bvqe\b|\bcircuit\b|\bpqc\b|variational quantum/i, "variational"],
  // 3. Sign-problem-free QMC: unbiased, with a statistical error bar - not exact (Tristan,
  //    2026-09-16). VarBench writes these "AFQMC (Metropolis), numerically exact", so this
  //    rule must come before the exact rule below. A Trotter-step extrapolation of such a
  //    run stays unbiased: it removes a controlled discretisation error of the method, it
  //    does not extrapolate a variational energy past what any state reached (RULES.md 4).
  [/\b(?:afqmc|qmc|quantum monte carlo|stochastic series expansion)\b.*numerically exact|numerically exact.*\b(?:afqmc|qmc)\b/i, "unbiased"],
  // 4. Exactly solved.
  //    NOTE: "QMC (continuous-time expansion)" is deliberately NOT here or above. It is
  //    unbiased for impurity models, but on the t-V lattice instances its
  //    rows sit ABOVE exact diagonalization (tV/chain_32_P_16_4) and above DMRG by
  //    4.7e-2 (tV/square_64_P_32_4), so it cannot be treated as a ground-state
  //    reference. Falls through to needs-review until someone classifies it per model.
  [/exact diagonalization|exact solution|numerically exact|full configuration interaction|\bfci\b|\bbethe ansatz\b/i, "exact"],
  // 5. Extrapolation of a variational energy is the reported number (bond dim, zero-variance)
  [/extrapolat/i, "extrapolated"],
  // 6. Strict variational upper bounds
  [/vmc|\brbm\b|\brnn\b|jastrow|dmrg|\bmps\b|\bpeps\b|tensor|mvmc|hidden fermion|\bhfds\b|backflow|\bbcs\b|slater|neural|\bnqs\b|transformer|\bvit\b|\bcnn\b|\bffn\b|clebsch|gutzwiller|vafqmc|variational|hartree|mean[- ]field|feed[- ]forward/i, "variational"],
];
export function classify(method) {
  const m = (method || "").trim();
  if (!m) return { bound_type: null, reason: "blank" };
  for (const [re, t] of RULES) if (re.test(m)) return { bound_type: t, reason: re.source.slice(0, 24) };
  return { bound_type: null, reason: "UNMATCHED" };
}
