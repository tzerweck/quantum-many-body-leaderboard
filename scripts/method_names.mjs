// Every published method string, mapped to a short name, the detail that tells rows of the
// same method apart, and the method family (Tristan, 2026-09-17). The published string stays
// on the row as `method_as_published`; nothing here changes an energy or a bound_type.
//
// `method` is the name alone. `detail` carries what distinguishes a row: architecture size,
// symmetry projection, Lanczos steps, trial state, what an extrapolation sends to zero. It
// never repeats another field: not the kind (exact, variational, extrapolated), not the
// instance (lattice, size, boundary, couplings, filling), not the provenance (this work,
// quoted, reference numbers), and not a number that lives in `compute` (bond dimension,
// parameter count, samples). Numbers the string states approximately ("~3200") stay in
// the detail, since compute holds only what was stated exactly.
//
// Entry: [method, detail, extra], extra = { family, bond_dimension, parameters, samples,
// sector, extrapolated, instance_detail } - `extrapolated` replaces the detail on the row VarBench
// printed as an extrapolation inside a DMRG string (emit.mjs), which shares the string with its
// finite-bond-dimension row. `instance_detail` ({ instance: detail }) replaces it on the instances
// named, where one printed label names different networks: a corrected published string quotes
// the source's label, and what tells the rows apart is the detail (Tristan, 2026-10-02).
//
// Symmetry and extrapolation are written in slots, after the free text and separated from it
// and from each other by "; ", in this order (Tristan, 2026-09-29):
//   symmetric: <groups>     built into the ansatz or the tensors, or named without saying how
//   projected: <groups>     projected onto, as the source says
//   extrapolated: <X → 0 or χ → ∞> (<how>)
// Groups come from SYMMETRY_TERMS. "unspecified" is a source that names no group; after a
// named group it means further groups the source does not name. validate.mjs holds every
// row to this (detailIssue).

const LANCZOS = n => n === 1 ? "1 Lanczos step" : `${n} Lanczos steps`;

export const SYMMETRY_TERMS = new Set(["SU(2)", "U(1) charge", "U(1) spin", "translations", "K = 0",
  "momentum", "spin parity", "spin parity (even)", "point group", "point group (simplified)", "A1", "C3",
  "C4", "C4v", "C6v", "sublattice", "full symmetry group", "unspecified",
  "unspecified (symmetry optimization)", "unspecified (symmetrized variants)"]);
const SLOTS = ["symmetric", "projected", "extrapolated"];
const EXTRAPOLATION = /^(?:(?:variance|truncation error|Δτ) → 0|χ → ∞)(?: \([^()]+\))?$/;
// Symmetry or extrapolation wording outside a slot. A Gutzwiller projection removes double
// occupancy; it is part of the state, not a symmetry.
const LOOSE = /symmetr|projection|(?<!Gutzwiller)-projected|→ [0∞]|extrapolat/i;

// Why a detail breaks the slot convention, or null.
export function detailIssue(detail) {
  const parts = detail ? detail.split("; ") : [];
  let last = -1;
  for (const part of parts) {
    const key = SLOTS.find(s => part.startsWith(`${s}: `));
    if (!key) {
      if (last >= 0) return `free text "${part}" after a slot`;
      if (LOOSE.test(part)) return `symmetry or extrapolation outside a slot: "${part}"`;
      continue;
    }
    const k = SLOTS.indexOf(key);
    if (k <= last) return `slot "${key}" repeated or out of order`;
    last = k;
    const value = part.slice(key.length + 2);
    if (key === "extrapolated") { if (!EXTRAPOLATION.test(value)) return `extrapolated: "${value}" is not X → 0 or χ → ∞`; continue; }
    const unknown = value.split(", ").filter(t => !SYMMETRY_TERMS.has(t));
    if (unknown.length) return `${key}: unknown group ${unknown.map(t => `"${t}"`).join(", ")}`;
  }
  return null;
}

export const NAMES = {
  // ---------------------------------------------------------------- exact
  "Exact diagonalization": ["ED", ""],
  "Exact Diagonalization": ["ED", ""],
  "Exact diagonalization (Lanczos)": ["ED", ""],
  "ED": ["ED", ""],
  "ED (this work)": ["ED", ""],
  "Exact Solution": ["Exact solution", ""],
  "QMC": ["QMC", "loop algorithm, ALPS, T = 1e-4, converged in T"],
  "QMC (stochastic series expansion)": ["SSE QMC", ""],
  "SSE QMC (stochastic series expansion), T -> 0 converged at beta/L = 32 and 64": ["SSE QMC", ""],
  "SSE QMC (stochastic series expansion), T -> 0 converged at beta/L = 32": ["SSE QMC", ""], // arXiv:2601.20189 Sec. IV: the open L x L and L x 2L tables ran at beta/L = 32 only
  "QMC (continuous-time expansion)": ["CT-QMC", "ground-state projector, Θ = 40, free-fermion trial state; LCT-INT of PRB 91, 235151"],
  "AFQMC (Metropolis), numerically exact": ["AFQMC", ""],
  "AFQMC (Metropolis, Trotter error extrapolated), numerically exact": ["AFQMC", "extrapolated: Δτ → 0"],
  "AFQMC, sign-problem-free at half filling (tau = 0.01, Trotter error below the statistical error)": ["AFQMC", "Δτ = 0.01"],

  // ---------------------------------------------------------------- projected
  "AFQMC (constrained-path)": ["CP-AFQMC", ""],
  "CP AFQMC with Constraint Release; no strict upper bound property": ["CP-AFQMC", "constraint release"],
  "ACE (16 conv layers) trial state + fixed-node GFMC": ["Fixed-node GFMC", "trial state: ACE, 16 conv layers", { family: "AFQMC / GFMC" }],
  "ACE+GFMC (GFMC projection on the ACE trial state)": ["Fixed-node GFMC", "trial state: ACE", { family: "AFQMC / GFMC" }],
  "SCALE (1 conv layer) trial state + fixed-node GFMC": ["Fixed-node GFMC", "trial state: SCALE, 1 conv layer", { family: "AFQMC / GFMC" }],
  "SCALE+GFMC (GFMC projection on the SCALE trial state)": ["Fixed-node GFMC", "trial state: SCALE", { family: "AFQMC / GFMC" }],
  // "FN on the state above": resolved per row from VarBench's row order (apply_method_names.mjs).

  // ---------------------------------------------------------------- tensor networks
  "DMRG": ["DMRG", ""],
  "DMRG (8x4)": ["DMRG", "truncation error ~1e-5"], // PRB 113, 245104, Fig. 2 caption: "a bond dimension of 8000 with maximum truncation error of ≃1×10−5"
  "DMRG keeping 4096 states": ["DMRG", "", { bond_dimension: 4096 }],
  "DMRG on the L x L torus, 4096 SU(2) states": ["DMRG", "symmetric: SU(2)", { bond_dimension: 4096 }],
  "DMRG on the L x L torus, 6144 SU(2) states": ["DMRG", "symmetric: SU(2)", { bond_dimension: 6144 }],
  "DMRG on the L x L torus, 8192 SU(2) states": ["DMRG", "symmetric: SU(2)", { bond_dimension: 8192 }],
  "DMRG, extrapolated in the truncation error (4096-8192 SU(2) states)": ["DMRG", "symmetric: SU(2); extrapolated: truncation error → 0 (4096 to 8192 states)"],
  "DMRG (∞)": ["DMRG", "symmetric: SU(2); extrapolated: truncation error → 0 (up to 8192 states)"], // arXiv:1311.5962 Table I column, L = 6 and 8 (the paper states the fit points for L = 10 only)
  "DMRG, truncation-error extrapolated (Torus 4)": ["DMRG", "extrapolated: truncation error → 0"],
  "DMRG, truncation-error extrapolated (Torus 6)": ["DMRG", "extrapolated: truncation error → 0"],
  "SU(2) DMRG, extrapolated (χ→∞, linear fit vs two-site variance), snake path": ["DMRG", "snake path; symmetric: SU(2); extrapolated: χ → ∞ (linear in two-site variance)"],
  "DMRG on TPU (bond dimension = 32768)": ["DMRG", "on TPUs", { bond_dimension: 32768 }],
  "DMRG (max truncation error ~ 1.0E-12)": ["DMRG", "truncation error ~1e-12"],
  "DMRG (max truncation error ~ 1.0E-13)": ["DMRG", "truncation error ~1e-13"],
  "DMRG (max truncation error ~ 1.0E-14)": ["DMRG", "truncation error ~1e-14"],
  "DMRG (max truncation error ~ 2.8E-12)": ["DMRG", "truncation error ~2.8e-12"],
  "DMRG (MaxTruncError ~1.87E-6, MaxBondDim=10000, Extrapolated Energy = - 251.4628 +/- 0.0019)": ["DMRG", "truncation error ~1.9e-6", { bond_dimension: 10000, extrapolated: "extrapolated: truncation error → 0" }],
  "DMRG (maxbonddim = 1550, extrapolated energy -12.266149729 +/- 5E-8)": ["DMRG", "", { bond_dimension: 1550, extrapolated: "extrapolated: truncation error → 0" }],
  "DMRG (MaxBondDim = 1550, Extrap Energy = -12.762823 +/- 2.e-6)": ["DMRG", "", { bond_dimension: 1550, extrapolated: "extrapolated: truncation error → 0" }],
  "DMRG (MaxBondDim ~1500, Extrap Eng = -9.9450941 +/- 2.9e-7)": ["DMRG", "bond dimension ~1500", { extrapolated: "extrapolated: truncation error → 0" }],
  "DMRG (MaxLinkDim = 10000, MaxTruncErr~2.0E-05, extrap energy -48.073 +/- 0.004)": ["DMRG", "truncation error ~2e-5", { bond_dimension: 10000, extrapolated: "extrapolated: truncation error → 0" }],
  "DMRG (MaxLinkDim = 12000, MaxTruncErr~6.6E-06, extrap energy -23.5658 +/- 0.0003)": ["DMRG", "truncation error ~6.6e-6", { bond_dimension: 12000, extrapolated: "extrapolated: truncation error → 0" }],
  "DMRG (MaxLinkDim=10000, MaxTruncErr ~ 3.4E-5, Extrap Energy -32.0027 +/- 0.0206)": ["DMRG", "truncation error ~3.4e-5", { bond_dimension: 10000, extrapolated: "extrapolated: truncation error → 0" }],
  "DMRG (MaxBondDim ~ 3200)": ["DMRG", "bond dimension ~3200"],
  "DMRG (MaxBondDim ~3200)": ["DMRG", "bond dimension ~3200"],
  "DMRG (MaxBondDim ~1500)": ["DMRG", "bond dimension ~1500"],
  "DMRG (MaxLinkDim ~ 3200)": ["DMRG", "bond dimension ~3200"],
  "Finite PEPS, gradient optimization": ["PEPS", "gradient optimization"],
  "PEPS (bond dimension = 10)": ["PEPS", "", { bond_dimension: 10 }],
  "PEPS, GO method, D=10, Dc=20": ["PEPS", "Dc = 20, gradient optimization", { bond_dimension: 10 }],
  "PEPS, GO method, D=8, Dc=16": ["PEPS", "Dc = 16, gradient optimization", { bond_dimension: 8 }],
  "PEPS, gradient optimization (GO) after SU initialization, D=10, Dc=20 (finite, open-boundary 6x6 cluster)": ["PEPS", "Dc = 20, gradient optimization after simple update", { bond_dimension: 10 }],
  "PEPS, gradient optimization (GO) after SU initialization, D=8, Dc=16 (finite, open-boundary 10x10 cluster)": ["PEPS", "Dc = 16, gradient optimization after simple update", { bond_dimension: 8 }],
  "PEPS, gradient optimization (GO) after SU initialization, D=8, Dc=16 (finite, open-boundary 6x6 cluster)": ["PEPS", "Dc = 16, gradient optimization after simple update", { bond_dimension: 8 }],
  "PEPS, simple-update (SU) imaginary-time evolution, D=10, Dc=20 (finite, open-boundary 10x10 cluster)": ["PEPS", "Dc = 20, simple update", { bond_dimension: 10 }],
  "PEPS+D. CNN": ["PEPS + CNN", "deep CNN", { family: "tensor network" }],
  "PEPS+S. CNN": ["PEPS + CNN", "shallow CNN", { family: "tensor network" }],
  "CNN-MPS": ["CNN-MPS", ""],
  "CNN-MPS (h,D,l)=(32,15,20)": ["CNN-MPS", "h = 32, l = 20; symmetric: C4v", { bond_dimension: 15 }], // arXiv:2603.14425 p. 4: C4v enforced for the last 10,000 of 15,000 steps
  "CNN-MPS (h,D,l)=(32,20,20), Marshall sign transformation": ["CNN-MPS", "h = 32, l = 20, Marshall sign", { bond_dimension: 20 }],
  "T-MPS": ["T-MPS", ""],

  // ---------------------------------------------------------------- RNN
  "1D MPS-RNN (bond dimension = 40)": ["1D MPS-RNN", "", { bond_dimension: 40, family: "RNN" }],
  "1D MPS-RNN (bond dimension = 64)": ["1D MPS-RNN", "", { bond_dimension: 64, family: "RNN" }],
  "2D MPS-RNN (bond dimension = 40)": ["2D MPS-RNN", "", { bond_dimension: 40, family: "RNN" }],
  "2D MPS-RNN (bond dimension = 64)": ["2D MPS-RNN", "", { bond_dimension: 64, family: "RNN" }],
  "Tensor-RNN (bond dimension = 40)": ["Tensor-RNN", "", { bond_dimension: 40 }],
  "Tensor-RNN (bond dimension = 64)": ["Tensor-RNN", "", { bond_dimension: 64 }],
  "1D LRU (linear recurrent unit) NQS, iterative retraining from cold start": ["LRU", "iterative retraining from a cold start", { family: "RNN" }],
  "1DRNN (3-layer GRU, 100 memory units)": ["RNN", "3-layer GRU, 100 memory units"],
  "2D Gated RNN": ["2D RNN", "gated"],
  "2D Recurrent Neural Network (2DRNN)": ["2D RNN", ""],
  "2D RNN wavefunction (best variational)": ["2D RNN", ""],
  "2D RNN wavefunction (iterative retraining, s=4.0, r=0.158)": ["2D RNN", "iterative retraining, s = 4.0, r = 0.158"],
  "2D RNN wavefunction, zero-variance extrapolation": ["2D RNN", "extrapolated: variance → 0"],
  "2D tensorized-GRU RNN wavefunction, best variational": ["2D RNN", "tensorized GRU"],
  "2D tensorized-GRU RNN, zero-variance extrapolation": ["2D RNN", "tensorized GRU; extrapolated: variance → 0"],
  "2D minGRU (ours)": ["minGRU", "6 layers, d_h = 512, b = 2; symmetric: C4v"], // arXiv:2605.13807 Table 4: the cold-start network (compute pass 2026-09-27)
  "2D minGRU, 3 layers, c4v symmetry, iterative retraining (PSR-NQS)": ["minGRU", "3 layers, d_h = 256, b = 2, iterative retraining; symmetric: C4v"], // Table 5
  "2D pRNN wave function (Marshall-sign-rotated, GRU cell, d_h=200) + Adam optimizer": ["pRNN", "GRU, hidden dimension 200, Marshall sign, Adam"],
  "2D pRNN wave function (Marshall-sign-rotated, GRU cell, d_h=200) + minSR optimizer (regularized)": ["pRNN", "GRU, hidden dimension 200, Marshall sign, MinSR"],
  "Adaptive RNN (hidden dim 32->256, doubling)": ["Adaptive RNN", "hidden dimension 32 → 256"],
  "Adaptive RNN with Early Stopping (hidden dim 2->256)": ["Adaptive RNN", "hidden dimension 2 → 256, early stopping"],
  "Static RNN (hidden dim 256)": ["RNN", "hidden dimension 256"],
  "LSTM": ["LSTM", ""],
  "RNN": ["RNN", ""],
  "RNN (zero-variance)": ["2D RNN", "extrapolated: variance → 0"], // arXiv:2502.17144 Table III: the paper's 2D RNN, as its other rows
  "RNN + translational symmetry": ["RNN", "symmetric: translations"],

  // ---------------------------------------------------------------- transformer / ViT
  "ViT": ["ViT", ""],
  "ViT with Spatial Attention, zero-variance extrapolation": ["ViT", "spatial attention, b = 4; extrapolated: variance → 0"], // arXiv:2602.02665 Sec. V.2: "b = 4 for the square lattice"
  "ViT with symmetry restoration": ["ViT", "spatial attention, b = 4; projected: translations, C4v"], // arXiv:2602.02665 Sec. IV: "full point-group (C4v) symmetry [-0.496732(1)]"
  "ViT with Spatial Attention, translations + C6v projection": ["ViT", "spatial attention, b = 3; projected: translations, C6v"], // arXiv:2602.02665 Table 1 (triangular)
  "ViT with Spatial Attention, zero-variance extrapolation (triangular)": ["ViT", "spatial attention, b = 3; extrapolated: variance → 0"],
  "Deep ViT": ["ViT", "factored attention, h = 12, d = 72, b = 2, 8 layers; projected: translations, C4v, spin parity"], // Rende et al., Commun. Phys. 7, 260, Sec. II and Eq. (12)
  "Factored attention (ViT, h=10,d=60,b=2,nl=4)": ["ViT", "factored attention, h = 10, d = 60, b = 2, 4 layers"],
  "Decoupled attention (ViT, h=10,d=60,b=2,nl=4)": ["ViT", "decoupled attention, h = 10, d = 60, b = 2, 4 layers"],
  "T5 attention (ViT, h=10,d=60,b=2,nl=4)": ["ViT", "T5 attention, h = 10, d = 60, b = 2, 4 layers"],
  "Factored-attention transformer (improved, Ns = 2^14, Np = 434760)": ["ViT", "factored attention, improved", { parameters: 434760, samples: 16384 }],
  "Convolutional transformer wave function (CTWF)": ["CTWF", ""],
  "Holographic Quantum Transformer (HQT)": ["HQT", ""],
  "Holographic Quantum Transformer (HQT), zero-shot 8x8->10x10 transfer": ["HQT", "8x8-trained model transferred to 10x10, then 50 iterations with the backbone frozen and 60 with it unfrozen on 10x10 (110 iterations, Fig. 3)"],
  "HQT (Ours)": ["HQT", ""],
  "HQT (Ours), Cold Start": ["HQT", "cold start"],
  "PITQS": ["PITQS", ""],
  "TQS": ["TQS", ""],
  "Transformer backflow": ["Transformer backflow", ""],
  "Transformer backflow + MARCH optimizer": ["Transformer backflow", "MARCH"],
  "NQS (transformer-based backflow ansatz)": ["Transformer backflow", ""],
  "Det": ["Transformer backflow", "Slater determinant", { family: "transformer / ViT" }],
  "Det, T": ["Transformer backflow", "Slater determinant; projected: translations", { family: "transformer / ViT" }],
  "Det-PH": ["Transformer backflow", "particle-hole determinant", { family: "transformer / ViT" }],
  "Pfaffian": ["Transformer backflow", "Pfaffian", { family: "transformer / ViT" }],
  // PRB 113, 245104 (arXiv:2510.11710), Appendix E Table I: every row is a ViT-parametrised state;
  // Symm-ViT is projected onto a space-group irrep, Symm-ViT-Ti is the translation-invariant sum
  // (Eq. 11). Architecture (h = 8, d = 64, b = 2, 2 layers) is common to all rows and left out.
  "HFDS-ViT, 8x8 torus": ["HFDS-ViT", "22 hidden fermions"],
  "HFDS Symm-ViT-Ti, 8x8 torus": ["HFDS-ViT", "ViT-Ti, 22 hidden fermions, k = (π/2, π/2); symmetric: translations"],
  "JBf-ViT (vision transformer backflow), 8x8 torus": ["JBf-ViT", "1 determinant"],
  "JBf Symm-ViT-Ti, 8x8 torus": ["JBf-ViT", "ViT-Ti, 1 determinant, k = (π/2, π/2); symmetric: translations"],

  // ---------------------------------------------------------------- CNN / ResNet
  "CNN": ["CNN", ""],
  "CNN (Li et al. 2022, sunway supercomputer)": ["CNN", ""],
  "CNN1": ["CNN", `CNN1, ${LANCZOS(1)}`], // Liang et al., MLST 4, 015035, Table 1 caption: "achieved by CNN1 with 106 529 parameters ... the Lanczos step with p = 1"
  "CNN NQS with symmetry projections": ["CNN", "projected: unspecified"],
  "CQNS": ["CNN", "M = 128, K = 9, replica-exchange MD"], // arXiv:1807.09422 Table I ("calculated by CQNS"; M = 128, K = 9), Sec. III
  "CNN1 (VMC, 100 SR steps)": ["CNN", "100 SR steps"],
  "CNN amplitude+phase NQS, O-tilde method (SR), Eq.(22)": ["CNN", "amplitude and phase, Õ method with SR"],
  "NQS (CNN+FCN sign-structure ansatz, 2745 parameters, 2000 MC samples), best-performing O-tilde method (Eq.22) with SR": ["CNN", "FCN sign structure, Õ method with SR", { parameters: 2745, samples: 2000, family: "CNN / ResNet" }],
  "Deep CNN": ["CNN", "deep"],
  "Shallow CNN": ["CNN", "shallow"],
  "S. CNN": ["CNN", "shallow"],
  "A5 residual-CNN, LR=0.002, seed 9 (HPO-selected)": ["ResNet", "A5, learning rate 0.002, seed 9"],
  "A5 residual-CNN, LR=0.005, seed 8 (HPO-selected)": ["ResNet", "A5, learning rate 0.005, seed 8"],
  "A9 residual-CNN (wide-shallow), LR=0.008, seed 9 (HPO-selected)": ["ResNet", "A9 wide-shallow, learning rate 0.008, seed 9"],
  // Chen & Heyl, Nat. Phys. 20, 1476 (arXiv:2302.01941): layers and channels from the authors' MinSR
  // examples/measure.py and figure data (ResNet1 146,320 parameters; ResNet2 1,071,488 and 34,944).
  "ResNet1 (MinSR)": ["ResNet", "64 conv layers, 16 channels, MinSR"],
  // One printed label, two networks: the legend "ResNet2 (MinSR)" is the 16x16 network in Fig. 2c and the 10x10
  // one (more than one million parameters, p. 3) in Fig. 2b.
  "ResNet2 (MinSR)": ["ResNet", "16 conv layers, 16 channels, MinSR", { instance_detail: { "J1J2/square_100_P_0.5": "30 conv layers, 64 channels, more than one million parameters, MinSR" } }],
  "ResNet2 MinSR, zero-variance extrapolation": ["ResNet", "MinSR; extrapolated: variance → 0"],
  "ConvNext (6,3,3)[2,2], 2.6e5 params": ["ConvNeXt", "(6,3,3)[2,2]", { parameters: 2.6e5 }],
  "aCNN(C4)": ["aCNN", "symmetric: C4"],
  "aCNN(C4v)": ["aCNN", "symmetric: C4v"],
  "aCNN, sign structure fixed to the exact (ED) one": ["aCNN", "sign structure from ED"],
  "aCNN": ["aCNN", "sign structure from ED"], // arXiv:2308.09664v2 Table 4 row "aCNN"; caption: "The aCNN is optimized with the exact sign structure from ED."
  "GCNN": ["GCNN", ""],
  "GCNN (6 layers, 6 feature maps), symmetric ansatz": ["GCNN", "6 layers, 6 feature maps; symmetric: unspecified"],
  "GCNN (deep group-convolutional network)": ["GCNN", ""],
  "GCNN (deep group-equivariant CNN)": ["GCNN", ""],
  "GCNN + Lanczos step": ["GCNN", LANCZOS(1)],
  "GCNN, spinon pair-density-wave state (chi0, P_Z2 = -1, q = (pi, pi/sqrt3))": ["GCNN", "spinon pair-density-wave state (χ0, P_Z2 = −1, q = (π, π/√3))"],
  "Group CNN": ["GCNN", ""],
  "Group CNN (deep, symmetry-projected)": ["GCNN", "deep; projected: unspecified"],
  "Lattice Convolutional Network": ["LCN", "", { family: "CNN / ResNet" }],
  "NAQS": ["NAQS", ""],
  "ACE (16 conv layers) + full symmetry projection": ["ACE", "16 conv layers; projected: full symmetry group"],
  "ACE (16 conv layers), no explicit symmetry": ["ACE", "16 conv layers"],
  "ACE (16 conv layers), no symmetry projection": ["ACE", "16 conv layers"],
  "ACE (Accurate Convolutional ansatz for lattice Electrons; deep convolutional backflow NQS)": ["ACE", ""],
  "SCALE (1 conv layer), no symmetry projection": ["SCALE", "1 conv layer"],
  "SCALE (Sparse Convolutional Ansatz for Lattice Electrons; efficient backflow NQS)": ["SCALE", ""],

  // ---------------------------------------------------------------- RBM
  "RBM (alpha = 1)": ["RBM", "α = 1"],
  // Chen, Hendry, Weinberg & Feiguin (arXiv:2206.14307) use psi_KL in every run: an RBM made even
  // under spin flip by dropping its biases (Eq. 3), projected on momentum and C4v (Eqs. 4-6).
  "RBM wave function": ["RBM", "symmetric: spin parity (even); projected: momentum, C4v"],
  "RBM wave function, no Lanczos": ["RBM", "symmetric: spin parity (even); projected: momentum, C4v"],
  "RBM wave function + 1-step Lanczos recursion": ["RBM", `${LANCZOS(1)}; symmetric: spin parity (even); projected: momentum, C4v`],
  "RBM wave function + 2-step Lanczos recursion": ["RBM", `${LANCZOS(2)}; symmetric: spin parity (even); projected: momentum, C4v`],
  "RBM with symmetry projections": ["RBM", "projected: unspecified"],
  // Nomura's uploads count one half of the network: every RBM of the paper has M/2 complex- and
  // M/2 real-parameter hidden units, and the stored energies are the M = 144 and 192 states of Fig. 3.
  "RBM with momentum (K=0), spin-parity (even S), and point-group (A1) projections, 72 hidden units": ["RBM", "144 hidden units (72 complex, 72 real); projected: K = 0, spin parity (even), A1"],
  "RBM with momentum (K=0), spin-parity (even S), and point-group (A1) projections, 96 hidden units": ["RBM", "192 hidden units (96 complex, 96 real); projected: K = 0, spin parity (even), A1"],
  "RBM+PP with momentum (K=0), spin-parity (even S), and point-group (A1) projections, 16 hidden units": ["RBM + PP", "16 hidden units; projected: K = 0, spin parity (even), A1"],
  "RBM+PP (momentum, spin-parity and simplified point-group projections, 16 hidden units, no sublattice structure)": ["RBM + PP", "16 hidden units, no sublattice structure; projected: momentum, spin parity, point group (simplified)"],
  "RBM+PP": ["RBM + PP", "4x4 sublattice structure; projected: momentum, spin parity, point group (simplified)"], // arXiv:2005.14142v1-v3 Table I, "Raw data of RBM+PP ground-state energy in Fig. 10", 8 x 8 with the 4 x 4 sublattice structure
  "RBM-fermionic": ["RBM", "fermionic"],
  "mVMC + RBM (as quoted)": ["mVMC + RBM", ""],
  "many-variable Gutzwiller-projected spinon-mean-field + RBM (mVMC, Ref. [7])": ["mVMC + RBM", ""],
  "mVMC-RBM (PP + RBM, spin-parity even)": ["mVMC + RBM", "projected: spin parity (even)"],
  "spin-parity mVMC-RBM/Lanczos (PP + RBM + 1st Lanczos step, spin-parity even, random initial state)": ["mVMC + RBM", "1 Lanczos step, random initial state; projected: spin parity (even)"],
  "mVMC (PP + RBM + 1st step Lanczos, spin-parity projection, Number of RBM neurons: 128)": ["mVMC + RBM", "1 Lanczos step, 128 RBM neurons; projected: spin parity"],
  "mVMC with SU(2) and momentum projections (gamma point) + RBM + Lanczos (Ncond = 214), alpha = 1, with 4x4 RBM subspace": ["mVMC + RBM", "Lanczos steps, α = 1, 4x4 RBM subspace; projected: SU(2), K = 0"],
  "mVMC with SU(2) and momentum projections (gamma point) + RBM + Lanczos (Ne = 214), alpha = 2, with 1x1 RBM subpsace": ["mVMC + RBM", "Lanczos steps, α = 2, 1x1 RBM subspace; projected: SU(2), K = 0"],
  "mVMC with SU(2) and momentum projections (gamma point) + RBM + Lanczos, (U=4), alpha = 4": ["mVMC + RBM", "Lanczos steps, α = 4; projected: SU(2), K = 0"],
  "mVMC with SU(2) and momentum projections (gamma point) + RBM + Lanczos, (U=4), alpha = 8 with 1x1 RBM subspace": ["mVMC + RBM", "Lanczos steps, α = 8, 1x1 RBM subspace; projected: SU(2), K = 0"],
  // The computing group's overview (VarBench Hubbard/supplements/Imada_group_overview.md) and run
  // inputs (varbench/methods scripts/Hubbard/.../mVMC/dat_input_makedef.txt) give the network sizes.
  "mVMC with SU(2) and momentum projections (gamma point) + RBM + Lanczos, (U=8)": ["mVMC + RBM", "Lanczos steps, α = 2, 4x4 RBM subspace; projected: SU(2), K = 0"],
  "mVMC with SU(2) and momentum projections (gamma point) + RBM + Lanczos, (U=8) (Ne = 64), alpha = 8 with 1x1 RBM-subspace": ["mVMC + RBM", "Lanczos steps, α = 4; projected: SU(2), K = 0"], // the string's alpha = 8 belongs to the earlier run the number replaced
  "mVMC with SU(2) and momentum projections (gamma point) + RBM + Lanczos, (U=8), alpha = 1": ["mVMC + RBM", "Lanczos steps, α = 1; projected: SU(2), K = 0"],
  "mVMC with SU(2) and momentum projections (gamma point) + RBM + Lanczos, (U=8), alpha = 8 with 1x1 RBM subspace": ["mVMC + RBM", "Lanczos steps, α = 8, 1x1 RBM subspace; projected: SU(2), K = 0"],

  // ---------------------------------------------------------------- classic VMC
  "mVMC (PP + 1st step Lanczos, spin-parity projection, C3 point-group projection)": ["mVMC", "1 Lanczos step; projected: spin parity, C3"],
  "mVMC (PP, spin-parity even, C3 projection), max.-flippable dimer initial state": ["mVMC", "max.-flippable dimer initial state; projected: spin parity (even), C3"],
  "mVMC (PP, spin-parity even, C3 projection), random initial state": ["mVMC", "random initial state; projected: spin parity (even), C3"],
  "mVMC (PP, spin-parity even), max.-flippable dimer initial state": ["mVMC", "max.-flippable dimer initial state; projected: spin parity (even)"],
  "mVMC (PP, spin-parity even), random initial state": ["mVMC", "random initial state; projected: spin parity (even)"],
  "mVMC/Lanczos (PP + 1st Lanczos step, spin-parity even, C3 projection), random initial state": ["mVMC", "1 Lanczos step, random initial state; projected: spin parity (even), C3"],
  "mVMC/Lanczos (PP + 1st Lanczos step, spin-parity even), max.-flippable dimer initial state": ["mVMC", "1 Lanczos step, max.-flippable dimer initial state; projected: spin parity (even)"],
  "mVMC/Lanczos (PP + 1st Lanczos step, spin-parity even), random initial state": ["mVMC", "1 Lanczos step, random initial state; projected: spin parity (even)"],
  "mVMC and mVMC/Lanczos, extrapolated in the variance": ["mVMC", "Lanczos steps; extrapolated: variance → 0"],
  "mVMC variance extrapolation (max. flip. initial state)": ["mVMC", "max.-flippable dimer initial state; extrapolated: variance → 0"],
  "mVMC variance extrapolation (random initial state)": ["mVMC", "random initial state; extrapolated: variance → 0"],
  "mVMC with SU(2) and point group projection": ["mVMC", "projected: SU(2), point group"],
  "mVMC with SU(2) and symmetry projections": ["mVMC", "projected: SU(2), unspecified"],
  "VMC": ["VMC", ""],
  "VMC (p = 2)": ["VMC", LANCZOS(2)],
  "VMC, p = 0 Lanczos steps": ["VMC", ""],
  "VMC + 1 Lanczos step": ["VMC", LANCZOS(1)],
  "VMC + 2 Lanczos steps": ["VMC", LANCZOS(2)],
  "VMC + Lanczos steps, extrapolated in the variance": ["VMC", "Lanczos steps; extrapolated: variance → 0"],
  "VMC with Dirac spin liquid + Jastrow": ["VMC", "Dirac spin liquid + Jastrow"],
  "VMC with Dirac+field+Jastrow": ["VMC", "Dirac spin liquid + field + Jastrow"],
  "VMC with fermions (flux+neel+Jastrow)": ["VMC", "fermions, flux + Néel + Jastrow"],
  "VMC with projected BCS (Z2 spin liquid)": ["VMC", "projected BCS, Z2 spin liquid"],
  "Gutzwiller-projected 120° magnetic state (π-flux hopping)": ["VMC", "120° order, π-flux hopping"], // arXiv:1512.03356 Table I
  "Gutzwiller-projected U(1) Dirac spin liquid": ["VMC", "U(1) Dirac spin liquid"],
  "Jastrow-Gutzwiller": ["VMC", "Jastrow-Gutzwiller"], // as arXiv:2602.02665 Table 1 prints it
  "p-BCS (projected BCS + spin Jastrow)": ["VMC", "projected BCS + spin Jastrow"],
  "RVB wave function": ["VMC", "RVB"],
  "Entangled-plaquette state (EPS), 16-site plaquettes": ["EPS", "16-site plaquettes", { family: "classic VMC" }],
  "VMC with projected fermions + Jastrow": ["VMC", "projected fermions + Jastrow"],
  "VMC, Gutzwiller-projected U(1) Dirac spin liquid (NN hopping, [0,pi] flux, no Jastrow), periodic-antiperiodic spinon boundary conditions": ["VMC", "U(1) Dirac spin liquid, [0,π] flux, periodic-antiperiodic spinon boundaries"],
  "VMC, Gutzwiller-projected U(1) Dirac spin liquid (NN hopping, [0,pi] flux, no Jastrow), periodic-periodic spinon boundary conditions": ["VMC", "U(1) Dirac spin liquid, [0,π] flux, periodic spinon boundaries"],
  "VMC, Gutzwiller-projected U(1) Dirac spin liquid SL-[0,pi], mixed spinon boundary conditions": ["VMC", "U(1) Dirac spin liquid, [0,π] flux, mixed spinon boundaries"],
  "DSL": ["VMC", `Gutzwiller-projected fermions (Dirac spin liquid), ${LANCZOS(2)}`], // arXiv:1601.06018 Table III, L = 12, column group DSL, 2-LS
  "Gutzwiller-projected mean field fermionic VMC": ["VMC", "Gutzwiller-projected fermions"],
  "AF + d+ + SFL/J/1Ls": ["VMC", `Gutzwiller-projected AF + d+id + staggered-flux mean field, spin Jastrow, ${LANCZOS(1)}`, { family: "classic VMC" }], // cond-mat/0509520 Table I: "our best wave-function"
  "Projected mean field ansatz": ["VMC", "projected mean field"],
  "Generalized RVB ansatz, unrestricted VMC optimization (no quantum-number projection)": ["VMC", "generalized RVB"],
  "EPS": ["EPS", "entangled-plaquette states, VMC", { family: "classic VMC" }], // arXiv:0905.3898 Tables II and IV, column "This work"; "Entangled-Plaquette States (EPS)"
  "Jastrow baseline": ["Jastrow", ""],
  "VMC Determinant Slater-Jastrow (RBM) Ansatz": ["Slater-Jastrow", "RBM Jastrow"],
  "VMC Determinant Slater-Jastrow (RBM) Ansatz with K=0 projections (symmetric wrt translations)": ["Slater-Jastrow", "RBM Jastrow; projected: K = 0"],
  "VMC Determinant Slater-Backflow-Jastrow (RBM) Ansatz with K=0 projections (symmetric wrt translations)": ["Slater-backflow-Jastrow", "RBM Jastrow; projected: K = 0"],
  "VMC stripe length=8 (+Jastrow and backflow)": ["VMC", "stripe λ = 8 + Jastrow + backflow"],
  "VMC uniform state (+Jastrow and backflow)": ["VMC", "uniform + Jastrow + backflow"],
  "VMC with Neel AF (+Jastrow and backflow)": ["VMC", "Néel + Jastrow + backflow"],
  "VMC with stripe of wavelength 6 (+Jastrow and backflow)": ["VMC", "stripe λ = 6 + Jastrow + backflow"],
  "VMC with stripe of wavelength 8 (+Jastrow and backflow)": ["VMC", "stripe λ = 8 + Jastrow + backflow"],
  "VMC with uniform BCS (+Jastrow and backflow)": ["VMC", "uniform BCS + Jastrow + backflow"],
  "VMC with uniform BCS pairing (+Jastrow and backflow)": ["VMC", "uniform BCS + Jastrow + backflow"],
  "VMC with uniform BCS pairing and Neel AF (+Jastrow and backflow)": ["VMC", "uniform BCS + Néel + Jastrow + backflow"],
  "VMC with uniform pairing (+Jastrow and backflow)": ["VMC", "uniform BCS + Jastrow + backflow"],

  // ---------------------------------------------------------------- mean field
  "HF": ["Hartree-Fock", ""],
  "HB K = 0 (HF)": ["Hartree-Fock", ""],
  "HB K = 0": ["Hartree-Fock", ""], // arXiv:2606.00924 text, "(HB K = 0)": the depth-0 state is Hartree-Fock

  // ---------------------------------------------------------------- backflow / Pfaffian
  "HB K = 1": ["Hierarchical backflow", "K = 1"],
  "HB K=1": ["Hierarchical backflow", "K = 1"],
  "Hierarchical Backflow (HB) VMC, path depth K=1": ["Hierarchical backflow", "K = 1"],
  "HB K = 2": ["Hierarchical backflow", "K = 2"],
  "HB K=2": ["Hierarchical backflow", "K = 2"],
  "Hierarchical Backflow (HB) VMC, path depth K=2": ["Hierarchical backflow", "K = 2"],
  "Residual Hierarchical Backflow (RHB) VMC (HB K=2 backbone + FNN, Ndet=5, Nneuron=100)": ["Residual hierarchical backflow", "K = 2 + FNN, 5 determinants, 100 neurons"],
  "RHB (hierarchical backflow K = 2 + nonlocal FNN factor, Ndet = 5, Nneuron = 100)": ["Residual hierarchical backflow", "K = 2 + FNN, 5 determinants, 100 neurons"],
  "RHB (HB K=2 backbone + FNN)": ["Residual hierarchical backflow", "K = 2 + FNN"],
  "BW1 (p=1)": ["Tensor backflow", "BW1, 1 Lanczos step"],
  "BW2 (p=1)": ["Tensor backflow", "BW2, 1 Lanczos step"],
  "Tensor-Backflow": ["Tensor backflow", ""],
  "Tensor-Backflow (E_p=0, no Lanczos step)": ["Tensor backflow", ""],
  "Tensor-Backflow (E_p=1, one Lanczos step)": ["Tensor backflow", LANCZOS(1)],
  "Tensor-Backflow + Lanczos": ["Tensor backflow", LANCZOS(1)],
  "Tensor-Backflow (NN backflow, direct optimization, Ep = 0)": ["Tensor backflow", "NN backflow, direct optimization"],
  "Tensor-Backflow + 1 Lanczos step (NN backflow, direct optimization, Ep = 1)": ["Tensor backflow", "NN backflow, direct optimization, 1 Lanczos step"],
  "Tensor-Backflow (no Lanczos step, Ep=0), direct optimization, 10x10 lattice, PBC": ["Tensor backflow", "direct optimization"],
  "Tensor-Backflow (no Lanczos step, Ep=0), direct optimization, 12x12 lattice, PBC": ["Tensor backflow", "direct optimization"],
  "Tensor-Backflow (no Lanczos step, Ep=0), direct optimization, 8x8 lattice, PBC": ["Tensor backflow", "direct optimization"],
  "Tensor-Backflow + 1 Lanczos step (Ep=1), direct optimization, 10x10 lattice, PBC": ["Tensor backflow", "direct optimization, 1 Lanczos step"],
  "Tensor-Backflow + 1 Lanczos step (Ep=1), direct optimization, 12x12 lattice, PBC": ["Tensor backflow", "direct optimization, 1 Lanczos step"],
  "Tensor-Backflow + 1 Lanczos step (Ep=1), direct optimization, 8x8 lattice, PBC": ["Tensor backflow", "direct optimization, 1 Lanczos step"],
  "Tensor-Backflow family, zero-variance extrapolation, PBC": ["Tensor backflow", "extrapolated: variance → 0"],
  "HFPS (hidden-fermion Pfaffian state)": ["HFPS", ""],
  "HFPS (initialized without a pairing field, metastable state)": ["HFPS", "no pairing field at initialization, metastable"],
  "HFPS + CNN Jastrow, VMC": ["HFPS", "CNN Jastrow"],
  "HFPS + sublattice-symmetric CNN Jastrow (VMC)": ["HFPS", "CNN Jastrow; symmetric: sublattice"],
  "HFPS + sublattice-symmetric CNN Jastrow, VMC": ["HFPS", "CNN Jastrow; symmetric: sublattice"],
  "HFPS + symmetry projection": ["HFPS", "projected: unspecified"],
  "Hidden-Fermion Pfaffian State (HFPS) + CNN Jastrow, VMC, small-scale (no sublattice symmetry) benchmark, ~150K parameters": ["HFPS", "CNN Jastrow, ~150K parameters"],
  // PRB 113, 245104 (arXiv:2510.11710), Table I left half: the Symm-ViT states, projected onto the
  // lowest space-group irrep (8x4: k_y = π with point group and spin parity; 8x8: k = (π/2, π/2)).
  "Hidden-fermion determinant state (HFDS), 8x4 cylinder": ["HFDS-ViT", "18 hidden fermions, k_y = π irrep; projected: translations, point group, spin parity"],
  "Hidden-fermion determinant state (HFDS), 8x8 torus": ["HFDS-ViT", "22 hidden fermions, k = (π/2, π/2); projected: translations"],
  "VMC Hidden Fermion Determinant State Ansatz (N_hidden = 10. Single hidden layer fully connected net with alpha = 64). C4 and K = 0 projections": ["HFDS", "10 hidden fermions, 1-layer FFN with α = 64; projected: K = 0, C4"],
  "VMC Hidden Fermion Determinant State Ansatz (N_hidden = 16, fully parametrized hidden sub-matrix, hidden-unit density alpha = 1)": ["HFDS", "16 hidden fermions, full hidden sub-matrix, α = 1"],
  "VMC Hidden Fermion Determinant State Ansatz (N_hidden = 16. Single hidden layer fully connected net with alpha = 1). Soft mean-field constraint for Neel order.": ["HFDS", "16 hidden fermions, 1-layer FFN with α = 1, Néel mean-field constraint"],
  "VMC Hidden Fermion Determinant State Ansatz (N_hidden = 16. Single hidden layer fully connected net with alpha = 14). Soft mean-field constraint for lambda = 8 stripe order.": ["HFDS", "16 hidden fermions, 1-layer FFN with α = 14, stripe λ = 8 mean-field constraint"],
  "VMC Hidden Fermion Determinant State Ansatz (N_hidden = 16. Single hidden layer fully connected net with alpha = 6). Soft mean-field constraint for lambda = 8 stripe order.": ["HFDS", "16 hidden fermions, 1-layer FFN with α = 6, stripe λ = 8 mean-field constraint"],
  "VMC Hidden Fermion Determinant State Ansatz (N_hidden = 8, fully parametrized hidden sub-matrix, hidden-unit density alpha = 78)": ["HFDS", "8 hidden fermions, full hidden sub-matrix, α = 78"],
  "hidden fermion determinant state with a fully parametrized hidden sub-matrix": ["HFDS", "8 hidden fermions, full hidden sub-matrix, α = 78"], // PNAS 119, e2122059119, SI Table 5 caption; the 6 x 6 network (SI Sec. 6). The 4 x 4 and 8 x 8 values share the caption with other sizes
  "VMC Hidden Fermion Determinant State Ansatz (N_hidden = 8. Single hidden layer fully connected net with alpha = 32)": ["HFDS", "8 hidden fermions, 1-layer FFN with α = 32"],
  "Jastrow-backflow (JBf), 8x4 cylinder": ["JBf-ViT", "1 determinant, k_y = π irrep; projected: translations, point group, spin parity"],
  "Jastrow-backflow (JBf), 8x8 torus": ["JBf-ViT", "1 determinant, k = (π/2, π/2); projected: translations"],
  "NNBF, 32 determinants + free projection to the fully symmetric state": ["NNBF", "32 determinants; projected: full symmetry group"],
  "NNBF, symmetry optimization with 32 determinants": ["NNBF", "32 determinants; symmetric: unspecified (symmetry optimization)"],
  "MLP-NNBF, 128 determinants, symmetry-optimized+projected": ["NNBF", "MLP, 128 determinants; symmetric: unspecified (symmetry optimization); projected: unspecified"],
  "MLP-NNBF, 4 determinants (symmetry-optimized)": ["NNBF", "MLP, 4 determinants; symmetric: unspecified (symmetry optimization)"],
  "MLP-NNBF, n_h=8192 (2-layer)": ["NNBF", "MLP, 2 layers, n_h = 8192"],
  "base MLP-NNBF, n_h=128": ["NNBF", "MLP, n_h = 128"],
  "NNB": ["NNBF", "backflow on a Slater determinant (Ψ_SN)", { family: "backflow / Pfaffian" }], // Luo & Clark, PRL 122, 226401, SM Table III
  "zero-variance extrapolation (NNBF + symmetrized variants)": ["NNBF", "symmetric: unspecified (symmetrized variants); extrapolated: variance → 0", { family: "backflow / Pfaffian" }],
  "VAFQMC": ["VAFQMC", ""],
  "VAFQMC (N_l=4)": ["VAFQMC", "N_l = 4"],
  "VAFQMC stripe length 8": ["VAFQMC", "stripe λ = 8"],
  "VAFQMC stripe length 8 APBC along the stripe": ["VAFQMC", "stripe λ = 8"],
  "VAFQMC stripe length=7": ["VAFQMC", "stripe λ = 7"],
  "VAFQMC stripe length=8": ["VAFQMC", "stripe λ = 8"],

  // ---------------------------------------------------------------- other NQS
  "arSJVMC (this work)": ["arSJVMC", ""],
  "GNN": ["GNN", ""],
  "GNN-2": ["GNN", "separate network per output (GNN-2)"],
  "MLP": ["MLP", ""],
  "Symmetric FFN, Relu, 32 features per translation": ["FFN", "ReLU, 32 features per translation; symmetric: unspecified"],
  "NN + Gutzwiller": ["Neural Gutzwiller", "", { family: "other NQS" }],
  "ClebschTree": ["ClebschTree", ""],
  "Grassmann Variational Monte Carlo (GVMC): CNN (ConvNeXt-style) backflow + complex RBM neural wave function, Grassmannian Stochastic Reconfiguration (SPRING/Woodbury), ground state |E0> in the (qx,qy,qsf)=(0,0,0) sector": ["GVMC", "ConvNeXt backflow + complex RBM, Grassmannian SR"],
  "Grassmann Variational Monte Carlo (GVMC): CNN backflow + complex RBM neural wave function, Grassmannian Stochastic Reconfiguration (SPRING/Woodbury), ground state |E0> in the (qx,qy,qsf)=(0,0,0)=Gamma sector": ["GVMC", "CNN backflow + complex RBM, Grassmannian SR"],

  // ---------------------------------------------------------------- VQE / circuit
  "VQE + symm. circuit (64 pars., exact grad, statevector)": ["VQE", "exact gradients, statevector; symmetric: unspecified", { parameters: 64 }],
  "VQE + symm. circuit (64 pars., 2^14 samples/grad)": ["VQE", "2^14 samples per gradient; symmetric: unspecified", { parameters: 64 }],
  "VQE + symm. circuit (96 pars., exact grads & metric, statevector)": ["VQE", "exact gradients and metric, statevector; symmetric: unspecified", { parameters: 96 }],
  "VQE + symm. circuit (96 pars., Ns = 2^14 per par, statevector)": ["VQE", "2^14 samples per parameter, statevector; symmetric: unspecified", { parameters: 96 }],
  "VQE (SR + symm. + 108 variational pars)": ["VQE", "SR; symmetric: unspecified", { parameters: 108 }],
  "VQE (SR + symm. + 64 par)": ["VQE", "SR; symmetric: unspecified", { parameters: 64 }],
  "VQE HV (d = 24)": ["VQE", "Hamiltonian variational, depth 24"],
  "VQE R-CX (d = 10)": ["VQE", "R-CX, depth 10"],
};

// A short name whose rows all belong to one family, so the family never depends on which
// published spelling a row carries ("Exact diagonalization (Lanczos)" was classic VMC, "CNN1 (VMC,
// 100 SR steps)" classic VMC, "2D Recurrent Neural Network (2DRNN)" other NQS). Names missing here
// ("VMC", split between classic and backflow states) keep the family views.mjs gives the
// published string.
export const FAMILY = {
  "ED": "other", "Exact solution": "other", "QMC": "other", "SSE QMC": "other", "CT-QMC": "other",
  "CNN": "CNN / ResNet", "2D RNN": "RNN", "RNN": "RNN", "HFPS": "backflow / Pfaffian", "ClebschTree": "other NQS", "NAQS": "other NQS",
};

// QMBL's own cost-to-reproduce runs (checks/cost/README.md): the detail says whose
// implementation and budget the number is, since a "ViT" row here is not the authors' code.
const QMBL_RUN = ", QMBL cost-to-reproduce run";
Object.assign(NAMES, {
  ["RBM (alpha = 1)" + QMBL_RUN]: ["RBM", "α = 1, QMBL run"],
  ["RBM, translation-symmetric (alpha = 4)" + QMBL_RUN]: ["RBM", "α = 4, QMBL run; symmetric: translations"],
  ["GCNN (translations, 4 layers, 8 features)" + QMBL_RUN]: ["GCNN", "4 layers, 8 features, QMBL run; symmetric: translations", { family: "CNN / ResNet" }],
  ["ViT (factored attention, 2x2 patches, d = 60, 4 layers, 10 heads)" + QMBL_RUN]: ["ViT", "factored attention, b = 2, d = 60, 4 layers, 10 heads, QMBL implementation"],
});
// The same runs on the size ladder's H100 (checks/cost/README.md, amendment v1.5): a second device, so
// the detail says so; their hours compare only with each other.
const LADDER = ", H100 size ladder";
for (const k of Object.keys(NAMES).filter(k => k.endsWith(QMBL_RUN))) {
  const [name, detail, extra] = NAMES[k];
  const [head, ...slots] = detail.split("; ");
  NAMES[k + LADDER] = [name, [head + LADDER, ...slots].join("; "), ...(extra ? [extra] : [])];
}

// Systematic families of strings, matched when no exact entry exists.
export const PATTERNS = [
  [/^DMRG \(chi = (\d+)\), QMBL cost-to-reproduce run$/, m => ["DMRG", "QMBL run", { bond_dimension: +m[1] }]],
  // "Exact Diagonalization Gamma.D6.A1 -1": the lowest state in one (momentum.irrep, spin flip) sector.
  [/^Exact Diagonalization (\S+\.\S+) (-?1)$/, m => ["ED", "", { sector: `${m[1]}, spin flip ${m[2] === "1" ? "+1" : "−1"}` }]],
  [/^DMRG \((?:bond dimension|Bond dimension) = (\d+)\)$/, m => ["DMRG", "", { bond_dimension: +m[1] }]],
  [/^DMRG \((?:MaxBondDim|maxbonddim) ?=? ?(\d+)\)$/, m => ["DMRG", "", { bond_dimension: +m[1] }]],
  [/^DMRG \(bond dimension (\d+)\) using fork tensor product states with U\(1\) symmetries for charge and spin sector$/, m => ["DMRG", "fork tensor product states; symmetric: U(1) charge, U(1) spin", { bond_dimension: +m[1] }]],
  [/^DMRG \(bond dimension (\d+)\) using fork tensor product states with U\(1\) symmetry for charge sector$/, m => ["DMRG", "fork tensor product states; symmetric: U(1) charge", { bond_dimension: +m[1] }]],
  [/^DMRG \(MaxLinkDim = (\d+), MaxTruncErr~([\d.]+)E-0?(\d+)\)$/, m => ["DMRG", `truncation error ~${+m[2]}e-${m[3]}`, { bond_dimension: +m[1] }]],
];

// "FN on the state above": VarBench prints each fixed-node row directly under the VMC row
// whose state is its trial state, and emit.mjs keeps that order.
export const FIXED_NODE_ABOVE = "FN on the state above";

export function lookup(published) {
  if (Object.hasOwn(NAMES, published)) return NAMES[published];
  for (const [re, f] of PATTERNS) { const m = published.match(re); if (m) return f(m); }
  return null;
}
