// Matrix-free Lanczos ground state of the OPEN transverse-field Ising chain
//   H = -sum_{i=1}^{N-1} sz_i sz_{i+1} - h sum_i sx_i        (Pauli operators)
// Basis: computational (sz) product states, bit i = spin i (0 -> +1, 1 -> -1).
function apply(N, h, v, out) {
  const D = 1 << N;
  out.fill(0);
  for (let s = 0; s < D; s++) {
    const a = v[s];
    if (a === 0) continue;
    // diagonal: -sum sz sz
    let d = 0;
    for (let i = 0; i < N - 1; i++) {
      const si = (s >> i) & 1, sj = (s >> (i + 1)) & 1;
      d -= (si === sj ? 1 : -1);
    }
    out[s] += d * a;
    // off-diagonal: -h sum sx  (flips one bit)
    for (let i = 0; i < N; i++) out[s ^ (1 << i)] -= h * a;
  }
}
function groundState(N, h, iters = 300) {
  const D = 1 << N;
  let v = new Float64Array(D), w = new Float64Array(D), vOld = new Float64Array(D);
  for (let i = 0; i < D; i++) v[i] = Math.sin(i * 1.2345 + 0.7);
  let n = Math.hypot(...[]) || Math.sqrt(v.reduce((a, x) => a + x * x, 0));
  for (let i = 0; i < D; i++) v[i] /= n;
  const alpha = [], beta = [];
  let b = 0;
  for (let it = 0; it < iters; it++) {
    apply(N, h, v, w);
    let a = 0; for (let i = 0; i < D; i++) a += w[i] * v[i];
    for (let i = 0; i < D; i++) w[i] -= a * v[i] + b * vOld[i];
    // full reorthogonalisation is unnecessary for the extremal eigenvalue at this size
    let nb = 0; for (let i = 0; i < D; i++) nb += w[i] * w[i];
    nb = Math.sqrt(nb);
    alpha.push(a); if (it) beta.push(b);
    if (nb < 1e-12) break;
    vOld.set(v); for (let i = 0; i < D; i++) v[i] = w[i] / nb;
    b = nb;
  }
  // smallest eigenvalue of the tridiagonal matrix, by bisection on Sturm sequences
  const m = alpha.length;
  const count = x => { let c = 0, q = alpha[0] - x;
    for (let i = 0; i < m; i++) { if (i) q = alpha[i] - x - beta[i-1]*beta[i-1]/(q || 1e-300); if (q < 0) c++; }
    return c; };
  let lo = -4 * N, hi = 4 * N;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (count(mid) >= 1) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
}
const paper = { 6: [-1.2160344, -1.2160383], 8: [-1.2297437, -1.2297439], 10: [-1.2381549, -1.238149],
                12: [-1.2438271, -1.2438309], 16: [-1.251015, -1.2510242] };
console.log(" N     our exact E/N      paper 'exact'     paper '1D LRU'    LRU - exact");
for (const N of [6, 8, 10, 12, 16]) {
  const e = groundState(N, 1) / N;
  const [lru, ex] = paper[N];
  console.log(String(N).padStart(2), e.toFixed(7).padStart(16), ex.toFixed(7).padStart(17),
    lru.toFixed(7).padStart(17), (lru - ex).toExponential(2).padStart(13),
    Math.abs(e - ex) < 2e-6 ? "  exact col OK" : "  MISMATCH");
}
