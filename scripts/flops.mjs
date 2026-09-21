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
// papers), so an estimate is good to about an order of magnitude and never better
// (calibration table in DATA.md). Three rules follow from that:
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
// A tensor network with a stated bond dimension has no model here: the sweep count is
// stated for none of the lattice rows (the 28 impurity FTPS rows are not on any cost figure),
// and a PEPS needs its contraction dimension. The four exact-diagonalization rows that state
// seconds per matrix-vector product do not state the Lanczos iteration count.

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
    if (!f || !h || h.unit !== "gpu") continue;
    out.push({ instance_id: inst.instance_id, method: r.method, detail: r.method_detail, arxiv: r.arxiv, device: r.compute.device,
      hours: h.value, derived: h.derived, flops: f.value, flops_per_s: f.value / (h.value * 3600), confidence: f.confidence, scope: r.compute.scope });
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
    console.log(`  ${c.instance_id}  ${c.method}${c.detail ? ` (${c.detail})` : ""}  ${c.flops.toExponential(2)} FLOPs / ${c.hours} h${c.derived ? " (derived)" : ""} on ${c.device} -> ${(c.flops_per_s / 1e12).toFixed(2)} TFLOP/s  [${c.confidence}, scope ${c.scope}]`);
}
