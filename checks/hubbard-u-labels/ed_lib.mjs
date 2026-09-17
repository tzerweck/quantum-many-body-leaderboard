// Small matrix-free exact-diagonalisation toolkit for the E1-exact-recompute group.
// Everything is written from scratch here (no netket): plain Lanczos with a second pass that
// rebuilds the Ritz vector and measures the true residual ||H x - E x|| / ||x||.

// ---------------------------------------------------------------- linear algebra helpers
export function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }

function xorshiftFill(v, seed) {
  let x = seed >>> 0 || 88172645;
  for (let i = 0; i < v.length; i++) {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    v[i] = x / 4294967296 - 0.5;
  }
}

// lowest eigenpair of the symmetric tridiagonal matrix (a: diag, b: off-diag, b.length = a.length-1)
export function tridiagLowest(a, b) {
  const m = a.length;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < m; i++) {
    const r = (i > 0 ? Math.abs(b[i - 1]) : 0) + (i < m - 1 ? Math.abs(b[i]) : 0);
    lo = Math.min(lo, a[i] - r); hi = Math.max(hi, a[i] + r);
  }
  const count = (x) => {
    let c = 0, q = a[0] - x;
    if (q < 0) c++;
    for (let i = 1; i < m; i++) {
      q = a[i] - x - (b[i - 1] * b[i - 1]) / (q === 0 ? 1e-300 : q);
      if (q < 0) c++;
    }
    return c;
  };
  for (let it = 0; it < 200; it++) {
    const mid = 0.5 * (lo + hi);
    if (mid === lo || mid === hi) break;
    if (count(mid) >= 1) hi = mid; else lo = mid;
  }
  const lam = 0.5 * (lo + hi);
  // inverse iteration with a shift just below lam: T - sigma is positive definite, Thomas is stable
  const sigma = lam - 1e-9 * Math.max(1, Math.abs(lam));
  let s = new Float64Array(m).fill(1);
  const cp = new Float64Array(m), dp = new Float64Array(m);
  for (let it = 0; it < 4; it++) {
    // solve (T - sigma) y = s
    let den = a[0] - sigma;
    cp[0] = m > 1 ? b[0] / den : 0; dp[0] = s[0] / den;
    for (let i = 1; i < m; i++) {
      den = a[i] - sigma - b[i - 1] * cp[i - 1];
      cp[i] = i < m - 1 ? b[i] / den : 0;
      dp[i] = (s[i] - b[i - 1] * dp[i - 1]) / den;
    }
    const y = new Float64Array(m);
    y[m - 1] = dp[m - 1];
    for (let i = m - 2; i >= 0; i--) y[i] = dp[i] - cp[i] * y[i + 1];
    const n = Math.sqrt(dot(y, y));
    for (let i = 0; i < m; i++) y[i] /= n;
    s = y;
  }
  return { lam, s };
}

// Lanczos ground state. apply(v, out) must ADD H v into out (out is zeroed by the caller here).
export function lanczos(apply, D, { maxIter = 600, checkEvery = 5, resTol = 1e-11, seed = 20260915, wantVec = true, log = null } = {}) {
  let v = new Float64Array(D), vp = new Float64Array(D), w = new Float64Array(D);
  const init = (buf) => { xorshiftFill(buf, seed); const n = Math.sqrt(dot(buf, buf)); for (let i = 0; i < D; i++) buf[i] /= n; };
  init(v);
  const a = [], b = [];
  let lam = NaN, s = null, resEst = NaN, m = 0, betaPrev = 0;
  for (let it = 0; it < maxIter; it++) {
    w.fill(0); apply(v, w);
    const alpha = dot(w, v);
    for (let i = 0; i < D; i++) w[i] -= alpha * v[i] + betaPrev * vp[i];
    const beta = Math.sqrt(dot(w, w));
    a.push(alpha); m = it + 1;
    const last = beta < 1e-12 * Math.max(1, Math.abs(alpha)) || it === maxIter - 1;
    if (m % checkEvery === 0 || last) {
      ({ lam, s } = tridiagLowest(a, b));
      resEst = beta * Math.abs(s[m - 1]);
      if (log) log(`  lanczos m=${m} E=${lam} resEst=${resEst.toExponential(2)}`);
      if (resEst < resTol || last) break;
    }
    b.push(beta);
    const tmp = vp; vp = v; v = tmp;
    for (let i = 0; i < D; i++) v[i] = w[i] / beta;
    betaPrev = beta;
  }
  const out = { E_ritz: lam, iterations: m, resEst, D };
  if (!wantVec) return out;
  // second pass: rebuild x = sum_k s_k v_k with the same recurrence
  const x = new Float64Array(D);
  init(v); vp.fill(0); betaPrev = 0;
  for (let k = 0; k < m; k++) {
    for (let i = 0; i < D; i++) x[i] += s[k] * v[i];
    if (k === m - 1) break;
    w.fill(0); apply(v, w);
    for (let i = 0; i < D; i++) w[i] = (w[i] - a[k] * v[i] - betaPrev * vp[i]) / b[k];
    const tmp = vp; vp = v; v = w; w = tmp;
    betaPrev = b[k];
  }
  vp = null; v = null;
  const hx = w; hx.fill(0); apply(x, hx);
  const xx = dot(x, x), xhx = dot(x, hx);
  const E = xhx / xx;
  let r2 = 0; for (let i = 0; i < D; i++) { const r = hx[i] - E * x[i]; r2 += r * r; }
  out.E = E; out.residual = Math.sqrt(r2 / xx);
  out.vec = x;
  return out;
}

// ---------------------------------------------------------------- bases
export function popcount(x) { x = x - ((x >>> 1) & 0x55555555); x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; }

export function binom(n, k) { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return Math.round(r); }

// all bit strings of length n with k ones, ascending; lookup table (dense) from bitstring to index
export function fixedWeightBasis(n, k) {
  const D = binom(n, k);
  const states = new Uint32Array(D);
  const lookup = new Int32Array(2 ** n).fill(-1);
  let c = 0;
  const lim = 2 ** n;
  for (let s = 0; s < lim; s++) if (popcount(s) === k) { lookup[s] = c; states[c++] = s; }
  if (c !== D) throw new Error("basis size mismatch");
  return { states, lookup, D };
}

// ---------------------------------------------------------------- spin-1/2 models, PAULI matrices
// H = sum_b J_b sigma_i . sigma_j   in a fixed-magnetisation sector
export function heisenbergOperator(N, nUp, bonds) {
  const { states, lookup, D } = fixedWeightBasis(N, nUp);
  const nb = bonds.length;
  const bi = Int32Array.from(bonds.map((x) => x[0])), bj = Int32Array.from(bonds.map((x) => x[1]));
  const bJ = Float64Array.from(bonds.map((x) => x[2]));
  const bm = Uint32Array.from(bonds.map((x) => ((1 << x[0]) | (1 << x[1])) >>> 0));
  const apply = (v, out) => {
    for (let k = 0; k < D; k++) {
      const x = v[k];
      const s = states[k];
      let d = 0;
      for (let q = 0; q < nb; q++) {
        if (((s >>> bi[q]) ^ (s >>> bj[q])) & 1) { d -= bJ[q]; out[lookup[(s ^ bm[q]) >>> 0]] += 2 * bJ[q] * x; }
        else d += bJ[q];
      }
      out[k] += d * x;
    }
  };
  return { apply, D };
}

// H = Jzz sum_b sz sz + Gamma sum_i sx   (full 2^N space, Pauli)
export function tfisingOperator(N, bonds, Jzz, Gamma) {
  const D = 2 ** N;
  const diag = new Float64Array(D);
  for (let s = 0; s < D; s++) { let d = 0; for (const [i, j] of bonds) d += (((s >>> i) ^ (s >>> j)) & 1) ? -Jzz : Jzz; diag[s] = d; }
  const apply = (v, out) => {
    for (let s = 0; s < D; s++) {
      const x = v[s]; out[s] += diag[s] * x;
      for (let i = 0; i < N; i++) out[s ^ (1 << i)] += Gamma * x;
    }
  };
  return { apply, D };
}

// ---------------------------------------------------------------- fermions
// sign of c^dag_i c_j on |s> (Jordan-Wigner, ascending orbital order), assuming bit j set, bit i empty
function jwSign(s, i, j) {
  const lo = Math.min(i, j), hi = Math.max(i, j);
  const mask = hi - lo > 1 ? (((2 ** hi) - (2 ** (lo + 1))) >>> 0) : 0;
  return (popcount((s & mask) >>> 0) & 1) ? -1 : 1;
}

// one-body operator sum_{i,j} h[i][j] c^dag_i c_j restricted to a fixed-particle basis, as CSR (row = source config)
// terms: array of [i, j, amp]; i===j gives amp * n_i
export function oneBodyCSR(basis, terms) {
  const { states, lookup, D } = basis;
  const rows = []; let nnz = 0;
  for (let k = 0; k < D; k++) {
    const s = states[k];
    const m = new Map();
    for (const [i, j, amp] of terms) {
      if (i === j) { if ((s >>> i) & 1) m.set(k, (m.get(k) || 0) + amp); continue; }
      if (!((s >>> j) & 1) || ((s >>> i) & 1)) continue;
      const t = ((s ^ (1 << j)) | (1 << i)) >>> 0;
      const k2 = lookup[t];
      m.set(k2, (m.get(k2) || 0) + amp * jwSign(s, i, j));
    }
    rows.push(m); nnz += m.size;
  }
  const ptr = new Int32Array(D + 1), col = new Int32Array(nnz), val = new Float64Array(nnz);
  let p = 0;
  for (let k = 0; k < D; k++) { ptr[k] = p; for (const [k2, a] of rows[k]) { col[p] = k2; val[p] = a; p++; } }
  ptr[D] = p;
  return { ptr, col, val, D, nnz };
}

// Spinful fermions in sector (N_up, N_dn): H = T_up (x) 1 + 1 (x) T_dn + diag
// index = iu * Dd + id ; JW ordering all up orbitals before all down orbitals (the down hop then
// passes the whole up block twice, so no cross sign). diagFn(su, sd) gives the diagonal interaction.
export function spinfulOperator(nOrb, nUp, nDn, termsUp, termsDn, diagFn) {
  const bu = fixedWeightBasis(nOrb, nUp);
  const bd = nUp === nDn ? bu : fixedWeightBasis(nOrb, nDn);
  const Tu = oneBodyCSR(bu, termsUp);
  const Td = (nUp === nDn && termsUp === termsDn) ? Tu : oneBodyCSR(bd, termsDn);
  const Du = bu.D, Dd = bd.D, D = Du * Dd;
  const diag = new Float64Array(D);
  for (let iu = 0; iu < Du; iu++) for (let id = 0; id < Dd; id++) diag[iu * Dd + id] = diagFn(bu.states[iu], bd.states[id]);
  const apply = (v, out) => {
    for (let iu = 0; iu < Du; iu++) {
      const base = iu * Dd;
      // up hops: whole row block
      for (let p = Tu.ptr[iu]; p < Tu.ptr[iu + 1]; p++) {
        const b2 = Tu.col[p] * Dd, a = Tu.val[p];
        for (let id = 0; id < Dd; id++) out[b2 + id] += a * v[base + id];
      }
      // down hops + diagonal
      for (let id = 0; id < Dd; id++) {
        const x = v[base + id];
        if (x === 0) continue;
        out[base + id] += diag[base + id] * x;
        for (let p = Td.ptr[id]; p < Td.ptr[id + 1]; p++) out[base + Td.col[p]] += Td.val[p] * x;
      }
    }
  };
  return { apply, D, Du, Dd, nnzUp: Tu.nnz, nnzDn: Td.nnz };
}

// spinless fermions with a diagonal density-density term
export function spinlessOperator(nOrb, nF, terms, diagFn) {
  const bs = fixedWeightBasis(nOrb, nF);
  const T = oneBodyCSR(bs, terms);
  const diag = new Float64Array(bs.D);
  for (let k = 0; k < bs.D; k++) diag[k] = diagFn(bs.states[k]);
  const apply = (v, out) => {
    for (let k = 0; k < bs.D; k++) {
      const x = v[k]; out[k] += diag[k] * x;
      for (let p = T.ptr[k]; p < T.ptr[k + 1]; p++) out[T.col[p]] += T.val[p] * x;
    }
  };
  return { apply, D: bs.D };
}

// hopping terms -t (c^dag_i c_j + c^dag_j c_i) for every edge
export function hoppingTerms(edges, t = 1) {
  const terms = [];
  for (const [i, j] of edges) { terms.push([i, j, -t]); terms.push([j, i, -t]); }
  return terms;
}

// dense symmetric eigenvalues (cyclic Jacobi), for free-fermion checks
export function symEig(A0) {
  const n = A0.length; const A = A0.map((r) => r.slice());
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-30) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-300) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
    }
  }
  return A.map((r, i) => r[i]).sort((x, y) => x - y);
}

// ---------------------------------------------------------------- transverse-field Ising chain, exact solutions
// H = -sum sz_i sz_{i+1} - h sum sx_i  (Pauli). On an even ring this has the same spectrum as VarBench's
// H = +sum sz sz + Gamma sum sx (sublattice rotation about x flips the zz sign, a global rotation about z flips Gamma).
// PBC, even-parity (Neveu-Schwarz) sector, k = pi(2n+1)/N: identical formula to programs/exact_ising_1d/exact_ising_1d.py
export function tfisingPBCFormula(N, h) {
  let E = 0;
  for (let n = 0; n < N; n++) E -= Math.sqrt(1 + h * h + 2 * h * Math.cos((Math.PI * (2 * n + 1)) / N));
  return E;
}
// OBC via Lieb-Schultz-Mattis: rotate to -sum sx sx - h sum sz, Jordan-Wigner with sz = 1 - 2n:
// H = sum A_ij c+_i c_j + 1/2 sum (B_ij c+_i c+_j + h.c.) - hN, A_ii = 2h, A_{i,i+1} = -1, B_{i,i+1} = -1 = -B_{i+1,i}
// E0 = -hN + Tr(A)/2 - 1/2 sum_k Lambda_k, Lambda_k^2 = eig[(A-B)(A+B)], and Tr(A)/2 = hN.
export function tfisingOBCBdG(N, h) {
  const M = Array.from({ length: N }, () => new Array(N).fill(0)); // M = A + B
  for (let i = 0; i < N; i++) M[i][i] = 2 * h;
  for (let i = 0; i < N - 1; i++) { M[i][i + 1] = -1 + -1; M[i + 1][i] = -1 + 1; }
  const MtM = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => { let s = 0; for (let k = 0; k < N; k++) s += M[k][i] * M[k][j]; return s; }));
  const ev = symEig(MtM);
  return -0.5 * ev.reduce((s, x) => s + Math.sqrt(Math.max(0, x)), 0);
}

// ---------------------------------------------------------------- lattices (mirroring VarBench programs/vmc_netket)
export function uniqueEdges(edges) {
  const seen = new Set(), out = [];
  for (const e of edges) { const i = Math.min(e[0], e[1]), j = Math.max(e[0], e[1]); if (i === j) throw new Error("self loop"); const key = i * 100000 + j; if (!seen.has(key)) { seen.add(key); out.push([i, j, ...e.slice(2)]); } }
  return out;
}

// nk.graph.Grid(extent=[L], pbc) for a chain; [L1, L2] for a 2D grid
export function gridEdges(extent, pbc) {
  const edges = [];
  if (extent.length === 1) {
    const L = extent[0];
    for (let i = 0; i < L - 1; i++) edges.push([i, i + 1]);
    if (pbc) edges.push([L - 1, 0]);
  } else {
    const [L1, L2] = extent;
    const k = (i, j) => (((i % L1) + L1) % L1) * L2 + (((j % L2) + L2) % L2);
    for (let i = 0; i < L1; i++) for (let j = 0; j < L2; j++) {
      if (i + 1 < L1 || pbc) edges.push([k(i, j), k(i + 1, j)]);
      if (j + 1 < L2 || pbc) edges.push([k(i, j), k(i, j + 1)]);
    }
  }
  return uniqueEdges(edges);
}

// verbatim port of ham.py ColoredJ1J2: [i, j, color]
export function coloredJ1J2(L1, L2, pbc, backDiag) {
  const k = (i, j) => (((i % L1) + L1) % L1) * L2 + (((j % L2) + L2) % L2);
  const p = pbc ? 1 : 0;
  const edges = [];
  for (let i = 0; i < L1; i++) for (let j = 0; j < L2 - 1 + p; j++) edges.push([k(i, j), k(i, j + 1), 0]);
  for (let i = 0; i < L1 - 1 + p; i++) for (let j = 0; j < L2; j++) edges.push([k(i + 1, j), k(i, j), 0]);
  for (let i = 0; i < L1 - 1 + p; i++) for (let j = 0; j < L2 - 1 + p; j++) {
    edges.push([k(i, j), k(i + 1, j + 1), 1]);
    if (backDiag) edges.push([k(i + 1, j), k(i, j + 1), 1]);
  }
  return edges; // NOT deduplicated, exactly as netket receives them
}

// nk.graph.Lattice nearest-neighbour edges: minimum-image distance shell, periodic in all directions.
// Returns unique edges plus, for diagnostics, the number of distinct nn images per pair.
export function latticeNNEdges(basis, extent, offsets, pbc) {
  const sites = [];
  const dim = basis.length;
  if (dim !== 2) throw new Error("2D only");
  for (let n1 = 0; n1 < extent[0]; n1++) for (let n2 = 0; n2 < extent[1]; n2++) for (const o of offsets)
    sites.push([n1 * basis[0][0] + n2 * basis[1][0] + o[0], n1 * basis[0][1] + n2 * basis[1][1] + o[1]]);
  const N = sites.length;
  const T1 = [extent[0] * basis[0][0], extent[0] * basis[0][1]], T2 = [extent[1] * basis[1][0], extent[1] * basis[1][1]];
  const dists = [];
  const pairImg = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const ds = [];
    for (let m1 = -2; m1 <= 2; m1++) for (let m2 = -2; m2 <= 2; m2++) {
      if (!pbc && (m1 || m2)) continue;
      const dx = sites[j][0] - sites[i][0] + m1 * T1[0] + m2 * T2[0], dy = sites[j][1] - sites[i][1] + m1 * T1[1] + m2 * T2[1];
      ds.push(Math.hypot(dx, dy));
    }
    pairImg.push([i, j, ds]);
    dists.push(Math.min(...ds));
  }
  const dmin = Math.min(...dists);
  const edges = [], multi = [];
  for (const [i, j, ds] of pairImg) {
    const c = ds.filter((d) => Math.abs(d - dmin) < 1e-6).length;
    if (c > 0) { edges.push([i, j]); if (c > 1) multi.push([i, j, c]); }
  }
  return { edges, multi, dmin, N, sites };
}
