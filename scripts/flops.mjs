// What a row's optimisation cost in floating-point operations, ESTIMATED from what its paper
// states (DATA.md, "How a FLOP count is estimated"). Nothing here is stored: the estimate is
// evaluated at build time from the row's `compute` block and its instance, and every figure
// that draws one says so. The stored fields stay as reported (DATA.md, "Never estimated").
//
// The first model, `nqs-v1`, counts network evaluations (`nqs-v2`, below, adds what the run states
// about how it evaluated the network; without such statements it is nqs-v1). One optimisation step draws `samples`
// configurations and, for each, evaluates the network for the local energy (once per
// off-diagonal Hamiltonian term that connects to the configuration), for the sampler (one
// sweep of N single-site proposals for Markov-chain sampling, one pass for an autoregressive
// draw) and for the gradient (forward plus backward, three forward-equivalents):
//
//   FLOPs = iterations x samples x (n_conn + k_sample + 3) x FLOPs_forward
//   FLOPs_forward = 2 x parameters x reuse (+ 2/3 N_e^3 for a determinant or Pfaffian)
//
// `reuse` is how many times a weight is applied in one forward pass: once in a dense
// network, once per site in a convolution or a recurrent cell, once per patch in a vision
// transformer. `n_conn` is a property of the instance (bonds for Heisenberg, sites for the
// transverse-field Ising model, four per bond for Hubbard). Excluded, and stated on every
// surface that shows the estimate: the stochastic-reconfiguration solve, symmetry projections
// that sum the network over a point group, attention scores, and any pre-training on smaller
// lattices. Under nqs-v2 the published rows that also state hours on a named GPU run at 10-45 %
// of their device's peak in the precision they used, and QMBL's own runs at 0.25-3.6 TFLOP/s on one
// A100, so an estimate is good to about an order of magnitude and never better (calibration
// table in DATA.md). Three rules follow from that:
//
// - An input nobody stated is never guessed. Parameters, samples and iterations must all be
//   on the row; the architecture must be in ARCH; the instance's lattice must be one whose
//   bond count is written below. Otherwise there is no estimate.
// - Estimates and reported hours never share an axis. FLOPs cannot be turned into hours
//   without a conversion factor, and DATA.md forbids that conversion.
// - Confidence is `medium` when the inputs are the row's own and the architecture is fully
//   stated, `low` when an architectural assumption was needed (a transformer whose patch
//   size is not stated) or the compute block is itself low confidence.
//
// DMRG has its own model, `dmrg-v1` (below), for rows whose compute block carries the sweep
// schedule the run script states: the 99 VarBench DMRG rows (read from their scripts, compute
// pass 2026-09-23) and QMBL's own DMRG rungs. A DMRG row from a paper states no sweep schedule
// and gets no estimate; a PEPS needs its contraction dimension; the 28 impurity FTPS rows are
// not on any cost figure. The four exact-diagonalization rows that state seconds per
// matrix-vector product do not state the Lanczos iteration count.

import fs from "node:fs";

// Architecture, by short method name (scripts/method_names.mjs; `archOf` below routes the
// dense RBMs). `reuse` is "sites", "patches" (sites / b^2, b read from the method detail, else
// the entry's `patch`), "group" (sites x the lattice's point group, a group convolution's
// kernel applied at every element of the space group; sites alone where the method detail
// says translations), or a number; `sampling` is "mcmc" or "ar" (autoregressive); `det` adds
// the determinant or Pfaffian of a fermionic state. Entries after Tensor backflow: compute
// pass 2026-09-24 (Tristan).
export const ARCH = {
  "RBM": { reuse: "sites", sampling: "mcmc", note: "translation-symmetric RBM: each hidden unit is evaluated at every translation" },
  "RBM (dense)": { reuse: 1, sampling: "mcmc", note: "dense RBM (NetKet's nk.models.RBM): every weight is applied once" },
  "CNN": { reuse: "sites", sampling: "mcmc" },
  "CNN-MPS": { reuse: "sites", sampling: "mcmc", note: "the CNN part; the MPS contraction is not counted" },
  "ViT": { reuse: "patches", sampling: "mcmc" },
  "TQS": { reuse: "sites", sampling: "mcmc", det: true, note: "the decoder is a multi-Slater backflow sampled by Markov chains, not autoregressively" },
  "PITQS": { reuse: "sites", sampling: "mcmc", det: true, note: "as TQS" },
  "RNN": { reuse: "sites", sampling: "ar" },
  "2D RNN": { reuse: "sites", sampling: "ar" },
  "minGRU": { reuse: "patches", patch: 2, sampling: "ar", note: "2 x 2 patches (PSR-NQS model.py)" },
  "LRU": { reuse: "sites", sampling: "ar" },
  "HFPS": { reuse: "sites", sampling: "mcmc", det: true, note: "the hidden-fermion network; the Pfaffian is counted as (2/3) N_e^3 and is negligible at these sizes" },
  "Tensor backflow": { reuse: 1, sampling: "mcmc", det: true, note: "the backflow tensor is read once per configuration; the determinant is counted as (2/3) N_e^3" },
  "Jastrow": { reuse: 2, sampling: "mcmc", note: "the N(N-1)/2 pair couplings are contracted as the full N x N matrix, each applied twice" },
  "GCNN": { reuse: "group", sampling: "mcmc", note: "group convolution over the space group; a spin-parity doubling is not counted" },
  "LCN": { reuse: "sites", sampling: "mcmc" },
  "ConvNeXt": { reuse: "patches", patch: 2, sampling: "mcmc", note: "2 x 2 patch stem" },
  "MLP": { reuse: 1, sampling: "mcmc" },
  "GVMC": { reuse: "sites", sampling: "mcmc", note: "one backflow network evaluation per configuration; the Grassmannian states' extra evaluations are not counted" },
  "pRNN": { reuse: "sites", sampling: "ar" },
  "Adaptive RNN": { reuse: "sites", sampling: "ar", note: "the final hidden dimension's parameters over all stages; earlier, narrower stages cost less" },
  "ACE": { reuse: "sites", sampling: "mcmc", det: true },
  // SCALE (local updates of at most 18 sites per move) and the transformer backflow (attention and several
  // determinants) are not in the model: against the per-step times their paper measures (arXiv:2604.25775)
  // nqs counting is 10x off in each direction (verification of 2026-09-25), so they get no estimate.
  "NNBF": { reuse: 1, sampling: "mcmc", det: true, note: "the MLP backflow, one pass per configuration; several determinants and symmetry projections are not counted" },
};

// The ARCH entry of a row. A VarBench RBM baseline (`α = 1`, programs/vmc_netket/vmc.py) and
// QMBL's own `α = 1` run are NetKet's dense RBM; the plain "RBM" entry is the translation-symmetric one.
// An RBM whose detail names the groups it is projected onto (Nomura's K = 0, A1, parity projected RBM) is dense too; its
// projection sum is the row's evaluation.evaluations_per_amplitude.
export const archOf = r => ARCH[r.method === "RBM" && (/^α = \d+(, QMBL run)?$/.test(r.method_detail || "") || /\bprojected: (?!unspecified)/.test(r.method_detail || "")) ? "RBM (dense)" : r.method];

// Point-group order of a lattice, for a group convolution over its full space group.
const POINT_GROUP = { square: 8, triangular: 12 };

// Nearest-neighbour bonds of an instance, or null where the lattice is not written here.
// Rectangular W x L cylinders (boundary PO) are periodic along W, the first number.
export function bondsOf(inst) {
  const { lattice, boundary, n_sites: N } = inst;
  if (lattice === "chain") return boundary === "O" ? N - 1 : N;
  const rect = lattice.match(/^rectangular-(\d+)x(\d+)$/);
  const side = Math.sqrt(N);
  const [W, L] = rect ? [+rect[1], +rect[2]] : Number.isInteger(side) ? [side, side] : [null, null];
  if (lattice === "square" || rect) {
    if (boundary === "O") return W == null ? null : W * (L - 1) + L * (W - 1);
    if (boundary === "PO") return W == null ? null : W * L + W * (L - 1);
    return 2 * N; // P, PA, and the tilted periodic squares (N = 40, 50)
  }
  if (lattice === "triangular") return boundary === "O" ? (W == null ? null : 3 * N - 4 * W + 1) : 3 * N;
  if (/^kagome/.test(lattice)) return boundary === "O" ? null : 2 * N;
  if (/^pyrochlore/.test(lattice)) return boundary === "O" ? null : 3 * N;
  return null;
}

// Next-nearest-neighbour bonds, square and rectangular lattices only.
function nnnBondsOf(inst) {
  const { lattice, boundary, n_sites: N } = inst;
  const rect = lattice.match(/^rectangular-(\d+)x(\d+)$/);
  const side = Math.sqrt(N);
  const [W, L] = rect ? [+rect[1], +rect[2]] : Number.isInteger(side) ? [side, side] : [null, null];
  if (lattice !== "square" && !rect) return null;
  if (boundary === "O") return W == null ? null : 2 * (W - 1) * (L - 1);
  if (boundary === "PO") return W == null ? null : 2 * W * (L - 1);
  return 2 * N;
}

// Off-diagonal Hamiltonian terms connected to one configuration: the network evaluations
// one local energy takes. With `rule` "all" (the default, and what NetKet does: it pads the
// local energy to every bond) every term counts. With "nonzero" (a code that evaluates only
// non-vanishing matrix elements, the row's `evaluation.local_energy`) a spin bond counts when
// its spins are antiparallel, two thirds of them in the antiferromagnetically correlated
// configurations these codes sample (0.63-0.73 measured, verification 2026-09-25), and a hop when its target is empty:
// N_e x z x (1 - n_sigma), which at doping 1/8 is a quarter of the four-per-bond count.
export function connectedOf(inst, rule = "all") {
  const b = bondsOf(inst);
  if (b == null) return null;
  if (rule === "nonzero") {
    const ne = electronsOf(inst), z = (2 * b) / inst.n_sites;
    switch (inst.model) {
      case "Heisenberg": return (2 / 3) * b;
      case "J1J2": { const nnn = nnnBondsOf(inst); return nnn == null ? null : (2 / 3) * (b + (inst.params.J2 ? nnn : 0)); }
      case "TFIsing": return inst.n_sites;
      case "Hubbard": return ne == null ? null : ne * z * (1 - inst.params.Nf / inst.n_sites);
      case "tV": return ne == null ? null : ne * z * (1 - ne / inst.n_sites);
      default: return null;
    }
  }
  switch (inst.model) {
    case "Heisenberg": return b;
    case "J1J2": { const nnn = nnnBondsOf(inst); return nnn == null ? null : b + (inst.params.J2 ? nnn : 0); }
    case "TFIsing": return inst.n_sites;
    case "Hubbard": return 4 * b; // two spins, two directions
    case "tV": return 2 * b;
    default: return null;
  }
}

// Electrons of a fermionic instance, for the determinant term.
const electronsOf = inst => (inst.model === "Hubbard" && inst.params.Nf ? 2 * inst.params.Nf : inst.model === "tV" && inst.params.Nf ? inst.params.Nf : null);

// The estimate for one row on its instance: { value, model, inputs, confidence, note }, or
// null when an input is missing. `value` is total floating-point operations.
export function flopsOf(r, inst) {
  const c = r.compute;
  if (c?.sweep_schedule) return dmrgFlopsOf(r, inst);
  if (c?.vmc_schedule?.kind === "mvmc") return mvmcFlopsOf(r, inst);
  if (c?.circuit_schedule?.runs) return vqeFlopsOf(r, inst);
  return nqsFlopsOf(r, inst);
}

// `nqs-v2` (Tristan, 2026-09-27, after the verification of 2026-09-25): nqs-v1 plus what the run
// states about how it evaluated the network (the block's `evaluation`, DATA.md). Per stage
//   FLOPs = iterations x samples x [(n_conn + 3) x m + proposals x (m, or 1 for an autoregressive draw)] x forward
//         + iterations x SR
//   forward = c_x x 2 x ((P - head) x reuse + head) (+ c_x x (2/3) N_e^3 for a determinant)
// c_x = 2 for complex parameters. Without an `evaluation` block every factor takes its nqs-v1 value.
// Where the forward pass was counted from the program JAX traces for the network
// (`evaluation.forward_flops`, QMBL's own runs: checks/cost/forward_flops.py, Tristan 2026-09-29),
// that count replaces the modelled forward; everything else in the formula stays.
function srFlops(sr, P, S, cx, forward, m) {
  switch (sr?.kind) {
    case "dense": return cx * (2 * S * P * P + (P * P * P) / 3);
    case "onthefly_dense": return 2 * P * S * forward * m + (cx * P * P * P) / 3; // P matrix-vector products, each a forward and backward pass over the samples
    case "cg": return sr.cg_iterations > 0 ? sr.cg_iterations * 2 * 2 * S * P * cx : 0;
    case "minsr": return cx * (2 * S * S * P + (S * S * S) / 3);
    default: return 0;
  }
}

function nqsFlopsOf(r, inst) {
  const c = r.compute;
  if (!c || !(c.parameters > 0) || !(c.samples > 0) || !(c.iterations > 0)) return null;
  const arch = archOf(r);
  if (!arch) return null;
  const ev = c.evaluation || {};
  const n_conn = connectedOf(inst, ev.local_energy || "all");
  if (n_conn == null) return null;
  const N = inst.n_sites;
  let reuse, assumption = null;
  if (ev.reuse > 0) reuse = ev.reuse;
  else if (arch.reuse === "sites") reuse = N;
  else if (arch.reuse === "patches") {
    const b = +((r.method_detail || "").match(/\bb = (\d+)\b/)?.[1] ?? arch.patch ?? 0);
    if (b) reuse = N / b ** 2;
    else { reuse = N; assumption = "patch size not stated, one token per site assumed (2 x 2 patches would divide the count by four)"; }
  } else if (arch.reuse === "group") {
    if (/translation/i.test(r.method_detail || "")) reuse = N;
    else {
      const g = POINT_GROUP[inst.lattice];
      if (!g) return null;
      reuse = N * g;
    }
  } else reuse = arch.reuse;
  const cx = ev.complex ? 2 : 1; // complex weights on real inputs: 4 real FLOPs per multiply-add, not 2 (complex-by-complex layers cost up to twice more)
  let det = 0;
  if (arch.det) {
    const ne = electronsOf(inst);
    if (ne == null) return null;
    det = cx * (2 / 3) * ne ** 3;
  }
  const k_sample = ev.proposals_per_sample > 0 ? ev.proposals_per_sample : arch.sampling === "ar" ? 1 : N;
  // An autoregressive sample is drawn from the unsymmetrised network, so its one pass is not
  // multiplied by the evaluations per amplitude; a Markov chain's proposals each need a full amplitude.
  const stages = ev.stages?.length ? ev.stages : [{}];
  // A counted forward pass is the whole network as it ran, one stage only.
  const counted = stages.length === 1 && ev.forward_flops?.flops_per_configuration > 0 ? ev.forward_flops.flops_per_configuration : null;
  let value = 0, sr = 0;
  const used = [];
  for (const st of stages) {
    const P = st.parameters ?? c.parameters, S = st.samples ?? c.samples, I = st.iterations ?? (stages.length === 1 ? c.iterations : null);
    const m = st.evaluations_per_amplitude ?? ev.evaluations_per_amplitude ?? 1;
    if (!(P > 0 && S > 0 && I > 0 && m > 0)) return null;
    const H = Math.min(ev.head_parameters || 0, P);
    const forward = counted ?? cx * 2 * ((P - H) * reuse + H) + det;
    const srStep = srFlops(ev.sr, P, S, cx, forward, m);
    const perSample = (n_conn + 3) * m + k_sample * (arch.sampling === "ar" ? 1 : m);
    value += I * S * perSample * forward + I * srStep;
    sr += I * srStep;
    used.push({ iterations: I, samples: S, parameters: P, evaluations_per_amplitude: m });
  }
  const confidence = assumption || c.confidence === "low" ? "low" : "medium";
  const note = [counted ? "forward pass counted from the network's traced program, not modelled" : arch.note, assumption,
    ev.sr?.kind === "cg" && !(ev.sr.cg_iterations > 0) ? "conjugate-gradient iterations not stated, the solve is not counted" : null,
    !ev.sr ? "the optimizer's linear solve is not counted" : null, c.scope !== "row" ? `inputs stated for the ${c.scope}, not this row` : null].filter(Boolean).join("; ");
  return { value, model: "nqs-v2", confidence, note,
    inputs: { stages: used, reuse, n_conn, local_energy: ev.local_energy || "all", k_sample, sampling: arch.sampling, complex: !!ev.complex,
      head_parameters: ev.head_parameters || 0, determinant: det || null, ...(counted ? { forward_counted: counted } : {}), sr: ev.sr?.kind || null, sr_flops: sr || null } };
}

// `mvmc-v2`: projected-fermion VMC in mVMC (Misawa et al., CPC 235, 447 (2019)), for a row whose block
// carries the run's def-file settings (`vmc_schedule`, kind "mvmc"). Calibrated on QMBL's own short runs of
// VarBench's inputs (2026-09-25, 4.6-17 GFLOP/s per core on an EPYC 9654):
//   FLOPs = c_x [ P_tot N_QP (r + a u) + N_it S_step N_QP (n_conn r + n^2)
//               + (a P_tot / N + N_it S_step) N_QP (7/3) n^3 ] + SR
//   P_tot = n_proc k [NVMCWarmUp + NVMCSample + (N_it - 1)(NVMCSample + 1)], k = N x NVMCInterval,
//   S_step = NVMCSample n_proc / NSplitSize, N_QP = NMPTrans NSPGaussLeg NQPOptTrans, n = Nsize,
//   r, u = 2n, 6n^2 for a hop and 2n^2, 34n^2 for an exchange; a = 1 (the acceptance, a bound: measured 0.4-0.5);
//   SR = N_it (2 c_x N_p^2 S_step + n_proc N_p^3 / 3) with NSRCG = 0, 100 N_it x 8 N_p S_step with NSRCG = 1
//   (100 CG iterations per step, the calibration's count, not the N_p worst case).
// Not counted: the correlator ratios (Jastrow, Gutzwiller, RBM), the Lanczos step, MPI reductions.
function mvmcFlopsOf(r, inst) {
  const c = r.compute, s = c.vmc_schedule, N = inst.n_sites;
  const need = ["n_proc", "NVMCSample", "NSROptItrStep", "NMPTrans", "NSPGaussLeg", "n_size", "parameters_real"];
  if (need.some(k => !(s[k] > 0))) return null;
  const n_conn = connectedOf(inst);
  if (n_conn == null) return null;
  const cx = s.complex ? 4 : 1, n = s.n_size, Nit = s.NSROptItrStep, a = 1;
  const k = N * (s.NVMCInterval || 1), NQP = s.NMPTrans * s.NSPGaussLeg * (s.NQPOptTrans || 1);
  const S = (s.NVMCSample * s.n_proc) / (s.NSplitSize || 1);
  const Ptot = s.n_proc * k * ((s.NVMCWarmUp || 0) + s.NVMCSample + (Nit - 1) * (s.NVMCSample + 1));
  const exchange = s.NExUpdatePath === 2;
  const rr = exchange ? 2 * n * n : 2 * n, uu = exchange ? 34 * n * n : 6 * n * n;
  const Np = s.parameters_real;
  const sr = s.NSRCG ? 100 * Nit * 8 * Np * S : Nit * (2 * cx * Np * Np * S + (s.n_proc * Np ** 3) / 3);
  const value = cx * (Ptot * NQP * (rr + a * uu) + Nit * S * NQP * (n_conn * rr + n * n) + ((a * Ptot) / N + Nit * S) * NQP * (7 / 3) * n ** 3) + sr;
  return { value, model: "mvmc-v2", confidence: "low", note: "acceptance bounded by 1 (measured 0.4-0.5, so sampling is overstated about twice); SR-CG at the calibration's 100 iterations per step; correlator ratios and the Lanczos step not counted",
    inputs: { n_size: n, projections: NQP, samples: S, iterations: Nit, proposals_total: Ptot, parameters_real: Np, complex: !!s.complex, exchange, n_conn, sr_flops: sr } };
}

// `vqe-v1`: the VarBench SU(2) VQE (programs/VQE: exact state vector in the S^z = 0 sector, natural
// gradient from derivative states and Hadamard-test overlaps projected on |G| symmetry terms), for a row
// whose block carries `circuit_schedule`. Per step of a run, with P gates, D amplitudes and n_H bond terms:
//   32 P^2 D + 32 P D + 8 |G| P^2 D + n_H P D (32 + 8 |G|) + 8 |G| P D + n_H D (32 + 8 |G|) + 8 |G| D
// (the metric tensor's 8 |G| P^2 D is a bound: the code pairs inverse elements, |G|/2 to |G| products, in
// single precision). Calibrated at 3.7-37 GFLOP/s per core (2026-09-25). Shots are binomial draws on exact
// probabilities and add no state-vector work.
const binom = (n, k) => { let x = 1; for (let i = 1; i <= k; i++) x = (x * (n - k + i)) / i; return x; };
function vqeFlopsOf(r, inst) {
  const s = r.compute.circuit_schedule, N = inst.n_sites;
  const P = s.gates, D = s.dimension ?? binom(N, N / 2), nH = connectedOf(inst);
  if (!(P > 0) || nH == null || !s.runs.length) return null;
  let value = 0;
  for (const run of s.runs) {
    const G = run.projector_terms;
    if (!(G > 0 && run.iterations > 0)) return null;
    value += run.iterations * (32 * P * P * D + 32 * P * D + 8 * G * P * P * D + nH * P * D * (32 + 8 * G) + 8 * G * P * D + nH * D * (32 + 8 * G) + 8 * G * D);
  }
  return { value, model: "vqe-v1", confidence: "low", note: "the schedule is the published script's; the script postdates the energy and crashes after its first run as published",
    inputs: { gates: P, dimension: D, n_H: nH, runs: s.runs.map(x => ({ projector_terms: x.projector_terms, iterations: x.iterations })) } };
}

// ---------------------------------------------------------------------------------------------
// `dmrg-v1`: two-site DMRG, for a row whose compute block carries the sweep schedule its run
// script states (`sweep_schedule`, DATA.md; the VarBench DMRG rows from their scripts, QMBL's own
// DMRG rungs from their results files). The model counts dense tensor contractions:
//
//   FLOPs = sum over sweeps of 2 x sum over the N - 1 two-site updates of
//             n_apply x apply(chi_l, chi_r) + svd(chi_l, chi_r) + environment(chi_l, chi_r)
//         + one <psi|H H|psi> contraction wherever the script evaluates the variance
//   apply = 2 d^2 D chi_l chi_r (chi_l + chi_r) + 4 d^3 D^2 chi_l chi_r
//   svd   = 4 m n min(m, n), m = d chi_l, n = d chi_r
//   environment = 2 d D chi_l chi_r (chi_l + chi_r) + 2 d^2 D^2 chi_l chi_r
//   <H^2> = sum over sites of 2 d D^2 chi_l chi_r (chi_l + chi_r) + 4 d^2 D^3 chi_l chi_r
//
// d is the site dimension, D the MPO bond dimension, n_apply the effective-Hamiltonian
// applications per update (the eigensolver setting of the code: at most 3 for ITensors.jl's
// defaults and for ITensor C++ at niter = 2; measured for TeNPy, whose Lanczos stops adaptively).
// The bond dimension at bond b in a sweep is the least of the sweep's maximum, the reached bond
// dimension the row states, and the exact limit min(d^b, d^(N-b)). D is 2 + k x (the largest
// number, over the cuts of the site order the script uses, of sites on one side with a coupling
// across it, taking the smaller side), k the operators per bond (3 for S+S- + S-S+ + SzSz, 1 for
// the Ising ZZ, 3 for tV, 4 for the two spin species' hops) — the rank bound an OpSum or MPO graph
// reaches; a code that logs its MPO (TeNPy) gives D directly. Not counted, and said with every
// estimate: the saving from conserved quantum numbers (block-sparse tensors; the model is dense),
// the noise or mixer term, the eigensolver's orthogonalisation, and memory traffic.

// Sites and couplings of a script's lattice, 0-based, in the script's own site order.
export function latticeEdges(l) {
  const e = [];
  if (l.order === "chain") {
    for (let i = 0; i < l.n_sites - 1; i++) e.push([i, i + 1]);
    if (l.periodic && l.n_sites > 2) e.push([0, l.n_sites - 1]);
    return { n: l.n_sites, e };
  }
  if (l.order === "edges") return { n: l.n_sites, e: l.edges.map(([a, b]) => [a - 1, b - 1]) };
  if (l.order === "snake") {
    // rows of `cols` sites, every second row reversed; wrap_row closes a row, wrap_col a column
    const { rows: R, cols: C } = l;
    const at = (i, j) => (i % 2 === 0 ? i * C + j : i * C + (C - 1 - j));
    const iMax = R - 1 + (l.wrap_col ? 1 : 0), jMax = C - 1 + (l.wrap_row ? 1 : 0);
    for (let i = 0; i < R; i++) for (let j = 0; j < jMax; j++) e.push([at(i, j), at(i, (j + 1) % C)]);
    for (let i = 0; i < iMax; i++) for (let j = 0; j < C; j++) e.push([at(i, j), at((i + 1) % R, j)]);
    for (let i = 0; i < iMax; i++) for (let j = 0; j < jMax; j++) {
      if (l.diagonals.includes("\\")) e.push([at(i, j), at((i + 1) % R, (j + 1) % C)]);
      if (l.diagonals.includes("/")) e.push([at(i, (j + 1) % C), at((i + 1) % R, j)]);
    }
    return { n: R * C, e };
  }
  if (l.order === "itensor-triangular") {
    // ITensor C++ v3 triangularLattice(Nx, Ny): site n = (x - 1) Ny + y, columns of Ny
    const { Nx, Ny } = l, N = Nx * Ny, yp = l.wrap_y && Ny > 2;
    for (let n = 1; n <= N; n++) {
      const x = Math.floor((n - 1) / Ny) + 1, y = ((n - 1) % Ny) + 1;
      if (x < Nx) e.push([n - 1, n + Ny - 1]);
      if (Ny > 1) {
        if (n + 1 <= N && (y < Ny || yp)) e.push([n - 1, n]);
        if (yp && y === 1) e.push([n - 1, n + Ny - 2]);
        if (x < Nx && y < Ny) e.push([n - 1, n + Ny]);
      }
    }
    return { n: N, e };
  }
  return null;
}

// The MPO bond dimension the model uses: stated by the code, or the rank bound over the cuts.
export function mpoBondDimension(l) {
  if (l.mpo_bond_dimension) return l.mpo_bond_dimension;
  const g = latticeEdges(l);
  if (!g) return null;
  let worst = 0;
  for (let c = 1; c < g.n; c++) {
    const left = new Set(), right = new Set();
    for (const [a, b] of g.e) {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      if (lo < c && hi >= c) { left.add(lo); right.add(hi); }
    }
    worst = Math.max(worst, Math.min(left.size, right.size));
  }
  return 2 + l.operators_per_bond * worst;
}

// TeNPy's Lanczos count, measured by the calibration run (checks/cost/calibration/), for QMBL's
// DMRG rungs that ran before the count was recorded.
let tenpyLanczos;
function measuredTenpyApplications() {
  if (tenpyLanczos !== undefined) return tenpyLanczos;
  tenpyLanczos = null;
  const dir = "checks/cost/calibration";
  if (!fs.existsSync(dir)) return null;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json"))) {
    const res = JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
    // The mean over Lanczos updates: the full diagonalisations TeNPy runs on the small blocks at
    // the chain's ends are counted apart, and cost next to nothing at any bond dimension.
    const l = res.rungs?.map(r => r.lanczos).filter(x => x?.lanczos_updates);
    if (l?.length) tenpyLanczos = { value: l.reduce((a, x) => a + x.applications, 0) / l.reduce((a, x) => a + x.lanczos_updates, 0), file: `${dir}/${f}` };
  }
  return tenpyLanczos;
}

function dmrgFlopsOf(r, inst) {
  const c = r.compute, s = c?.sweep_schedule;
  if (!s || !Array.isArray(s.maxdim) || !s.maxdim.length) return null;
  const l = s.lattice, d = l.site_dimension, D = mpoBondDimension(l);
  const N = l.n_sites ?? latticeEdges(l)?.n ?? inst.n_sites;
  if (!D || !N) return null;
  let nApply = s.eigensolver_applications, assumption = null;
  if (!(nApply > 0)) {
    const m = measuredTenpyApplications();
    if (!m) return null;
    nApply = m.value;
    assumption = `Lanczos applications per update not recorded by this run; ${m.value.toFixed(1)} measured on the calibration run (${m.file})`;
  }
  const stated = c.bond_dimension ?? Infinity;
  const exact = b => Math.min(b, N - b) * Math.log(d) > Math.log(1e8) ? Infinity : d ** Math.min(b, N - b);
  const chiAt = (m, b) => (b <= 0 || b >= N ? 1 : Math.min(m, stated, exact(b)));
  const sweep = m => {
    let f = 0;
    for (let i = 0; i < N - 1; i++) {
      const cl = chiAt(m, i), cm = chiAt(m, i + 1), cr = chiAt(m, i + 2);
      const apply = 2 * d * d * D * cl * cr * (cl + cr) + 4 * d ** 3 * D * D * cl * cr;
      const mm = d * cl, nn = d * cr;
      const svd = 4 * mm * nn * Math.min(mm, nn);
      const env = 2 * d * D * cl * cm * (cl + cm) + 2 * d * d * D * D * cl * cm;
      f += nApply * apply + svd + env;
    }
    return 2 * f;
  };
  const variance = m => {
    let f = 0;
    for (let i = 0; i < N; i++) {
      const cl = chiAt(m, i), cr = chiAt(m, i + 1);
      f += 2 * d * D * D * cl * cr * (cl + cr) + 4 * d * d * D ** 3 * cl * cr;
    }
    return f;
  };
  const memo = new Map();
  const once = (k, fn) => (memo.has(k) ? memo.get(k) : (memo.set(k, fn()), memo.get(k)));
  let value = 0;
  for (const m of s.maxdim) value += once(`s${m}`, () => sweep(m));
  for (const k of s.variance_after || []) { const m = s.maxdim[k - 1]; value += once(`v${m}`, () => variance(m)); }
  const confidence = assumption || c.confidence === "low" ? "low" : "medium";
  const note = ["dense count: the saving from conserved quantum numbers is not counted", assumption, c.scope !== "row" ? `inputs stated for the ${c.scope}, not this row` : null].filter(Boolean).join("; ");
  return { value, model: "dmrg-v1", confidence, note,
    inputs: { code: s.code, sweeps: s.maxdim.length, max_bond_dimension: Math.max(...s.maxdim), reached: Number.isFinite(stated) ? stated : null,
      mpo_bond_dimension: D, site_dimension: d, n_apply: nApply, variance_evaluations: (s.variance_after || []).length, n_sites: N } };
}

// The estimate as a cost for pareto.mjs: { value, unit: "flops", derived: true, low }.
export function estimatedFlopsOf(c, r, inst) {
  const f = r && inst ? flopsOf(r, inst) : null;
  return f ? { value: f.value, unit: "flops", derived: f.confidence === "low", estimate: f } : null;
}

// Achieved FLOP/s implied by the estimate for rows that also state GPU-hours: the model's
// calibration. Printed by `node scripts/flops.mjs`.
export function calibration(instances, hoursOf) {
  const out = [];
  for (const inst of instances) for (const r of inst.rows) {
    const f = flopsOf(r, inst), h = hoursOf(r.compute);
    if (!f || !h || (h.unit !== "gpu" && !["dmrg-v1", "mvmc-v2", "vqe-v1"].includes(f.model))) continue;
    out.push({ instance_id: inst.instance_id, method: r.method, detail: r.method_detail, arxiv: r.arxiv, device: r.compute.device,
      hours: h.value, unit: h.unit, model: f.model, derived: h.derived, flops: f.value, flops_per_s: f.value / (h.value * 3600), confidence: f.confidence, scope: r.compute.scope });
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("flops.mjs")) {
  const { collect } = await import("./summary.mjs");
  const { hoursOf } = await import("./cost.mjs");
  const instances = collect();
  let n = 0, low = 0;
  const byMethod = {};
  for (const inst of instances) for (const r of inst.rows) {
    const f = flopsOf(r, inst);
    if (!f) continue;
    n++; if (f.confidence === "low") low++;
    byMethod[r.method] = (byMethod[r.method] || 0) + 1;
  }
  console.log(`estimated FLOPs: ${n} rows (${low} low confidence): ${Object.entries(byMethod).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log("\ncalibration (rows that also state GPU-hours):");
  for (const c of calibration(instances, hoursOf))
    console.log(`  ${c.instance_id}  ${c.method}${c.detail ? ` (${c.detail})` : ""}  ${c.flops.toExponential(2)} FLOPs / ${c.hours} ${c.unit === "cpu" ? "core-h" : "h"}${c.derived ? " (derived)" : ""} on ${c.device} -> ${c.unit === "cpu" ? `${(c.flops_per_s / 1e9).toFixed(1)} GFLOP/s per core` : `${(c.flops_per_s / 1e12).toFixed(2)} TFLOP/s`}  [${c.model}, ${c.confidence}, scope ${c.scope}]`);
}
