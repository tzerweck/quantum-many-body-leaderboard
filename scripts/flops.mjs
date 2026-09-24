// What a row's optimisation cost in floating-point operations, ESTIMATED from what its paper
// states (DATA.md, "How a FLOP count is estimated"). Nothing here is stored: the estimate is
// evaluated at build time from the row's `compute` block and its instance, and every figure
// that draws one says so. The stored fields stay as reported (DATA.md, "Never estimated").
//
// The model, `nqs-v1`, counts network evaluations. One optimisation step draws `samples`
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
// lattices. Against the ten rows whose paper also states hours on a named GPU, the model
// implies 0.5 to 21 TFLOP/s achieved (consistent within one paper, a factor of forty across
// papers), and against QMBL's own measured runs 0.03 to 5 TFLOP/s on one A100 (a network
// under ~1e4 parameters is overhead-bound and the estimate falls 30-100x short), so an
// estimate is good to about an order of magnitude for a network that fills a GPU and never
// better (calibration table in DATA.md). Three rules follow from that:
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

// Architecture, by short method name (scripts/method_names.mjs). `reuse` is "sites",
// "patches" (sites / b^2, b read from the method detail), or 1; `sampling` is "mcmc" or
// "ar" (autoregressive); `det` adds the determinant or Pfaffian of a fermionic state.
export const ARCH = {
  "RBM": { reuse: "sites", sampling: "mcmc", note: "translation-symmetric RBM: each hidden unit is evaluated at every translation" },
  "CNN": { reuse: "sites", sampling: "mcmc" },
  "CNN-MPS": { reuse: "sites", sampling: "mcmc", note: "the CNN part; the MPS contraction is not counted" },
  "ViT": { reuse: "patches", sampling: "mcmc" },
  "TQS": { reuse: "sites", sampling: "ar" },
  "PITQS": { reuse: "sites", sampling: "ar" },
  "RNN": { reuse: "sites", sampling: "ar" },
  "2D RNN": { reuse: "sites", sampling: "ar" },
  "minGRU": { reuse: "sites", sampling: "ar" },
  "LRU": { reuse: "sites", sampling: "ar" },
  "HFPS": { reuse: "sites", sampling: "mcmc", det: true, note: "the hidden-fermion network; the Pfaffian is counted as (2/3) N_e^3 and is negligible at these sizes" },
  "Tensor backflow": { reuse: 1, sampling: "mcmc", det: true, note: "the backflow tensor is read once per configuration; the determinant is counted as (2/3) N_e^3" },
};

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
// one local energy takes. An upper bound where matrix elements can vanish (parallel spins
// on a Heisenberg bond, a Pauli-blocked hop), by at most a factor of two.
export function connectedOf(inst) {
  const b = bondsOf(inst);
  if (b == null) return null;
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
  return r.compute?.sweep_schedule ? dmrgFlopsOf(r, inst) : nqsFlopsOf(r, inst);
}

function nqsFlopsOf(r, inst) {
  const c = r.compute;
  if (!c || !(c.parameters > 0) || !(c.samples > 0) || !(c.iterations > 0)) return null;
  const arch = ARCH[r.method];
  if (!arch) return null;
  const n_conn = connectedOf(inst);
  if (n_conn == null) return null;
  const N = inst.n_sites;
  let reuse, assumption = null;
  if (arch.reuse === "sites") reuse = N;
  else if (arch.reuse === "patches") {
    const m = (r.method_detail || "").match(/\bb = (\d+)\b/);
    if (m) reuse = N / (+m[1]) ** 2;
    else { reuse = N; assumption = "patch size not stated, one token per site assumed (2 x 2 patches would divide the count by four)"; }
  } else reuse = arch.reuse;
  let det = 0;
  if (arch.det) {
    const ne = electronsOf(inst);
    if (ne == null) return null;
    det = (2 / 3) * ne ** 3;
  }
  const k_sample = arch.sampling === "ar" ? 1 : N;
  const forward = 2 * c.parameters * reuse + det;
  const perSample = n_conn + k_sample + 3;
  const value = c.iterations * c.samples * perSample * forward;
  const confidence = assumption || c.confidence === "low" ? "low" : "medium";
  const note = [arch.note, assumption, c.scope !== "row" ? `inputs stated for the ${c.scope}, not this row` : null].filter(Boolean).join("; ");
  return { value, model: "nqs-v1", confidence, note,
    inputs: { parameters: c.parameters, samples: c.samples, iterations: c.iterations, reuse, n_conn, k_sample, sampling: arch.sampling, determinant: det || null } };
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
    if (!f || !h || (h.unit !== "gpu" && f.model !== "dmrg-v1")) continue;
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
