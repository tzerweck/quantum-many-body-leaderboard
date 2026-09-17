#!/usr/bin/env python3
"""Independent ED for small VarBench Hubbard instances (group B2 check).

H = -t sum_<ij>,s (c+_is c_js + h.c.) + U sum_i n_i,up n_i,dn,  t = 1,  fixed N_up = N_dn = Nf.
No lattice symmetry is imposed, so the lowest eigenvalue is the global ground state of the
(N_up, N_dn) sector. Basis |up config> (x) |dn config>, operator order all-up then all-dn, so
up hopping carries only the up Jordan-Wigner sign and dn hopping only the dn sign.
Wavefunction stored as a matrix Psi[a, b]:  H Psi = T Psi + Psi T^T + U * D o Psi,
D[a, b] = number of doubly occupied sites.
"""
import itertools, json, os, sys, time
os.environ.setdefault("OMP_NUM_THREADS", "4")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "4")
import numpy as np
import scipy.sparse as sp
from scipy.sparse.linalg import eigsh, LinearOperator

def bonds_chain(L):
    return [(i, (i + 1) % L) for i in range(L)]

def bonds_square(L):
    k = lambda x, y: (x % L) * L + (y % L)
    b = []
    for x in range(L):
        for y in range(L):
            b.append((k(x, y), k(x + 1, y)))
            b.append((k(x, y), k(x, y + 1)))
    return b

def hopping(L, n, bonds):
    states = np.array(sorted(sum(1 << i for i in c) for c in itertools.combinations(range(L), n)), dtype=np.int64)
    idx = -np.ones(1 << L, dtype=np.int64)
    idx[states] = np.arange(len(states))
    rows, cols, vals = [], [], []
    for a, s in enumerate(states.tolist()):
        for (i, j) in bonds:
            for (p, q) in ((i, j), (j, i)):          # c+_p c_q
                if (s >> q) & 1 and not (s >> p) & 1:
                    lo, hi = min(p, q), max(p, q)
                    mask = ((1 << hi) - 1) & ~((1 << (lo + 1)) - 1)
                    sign = -1.0 if bin(s & mask).count("1") % 2 else 1.0
                    rows.append(idx[s ^ (1 << p) ^ (1 << q)]); cols.append(a); vals.append(-sign)
    T = sp.csr_matrix((vals, (rows, cols)), shape=(len(states), len(states)))
    assert abs(T - T.T).max() < 1e-14
    occ = ((states[:, None] >> np.arange(L)[None, :]) & 1).astype(np.float64)
    D = (occ @ occ.T).astype(np.uint8)
    return states, T, D

def make_matvec(T, D, U):
    n = T.shape[0]
    def mv(v):
        P = np.asarray(v, dtype=np.float64).reshape(n, n)
        out = T @ P
        out += (T @ np.ascontiguousarray(P.T)).T
        step = 256
        for r in range(0, n, step):
            out[r:r + step] += U * (D[r:r + step] * P[r:r + step])
        return out.reshape(-1)
    return mv

def lanczos(mv, dim, maxit=400, tol=1e-12, seed=7):
    rng = np.random.default_rng(seed)
    v = rng.standard_normal(dim); v /= np.linalg.norm(v)
    v_prev = np.zeros(dim); beta = 0.0
    alphas, betas = [], []
    last = None; stable = 0; it = 0
    for it in range(maxit):
        w = mv(v)
        a = float(v @ w); alphas.append(a)
        w -= a * v; w -= beta * v_prev
        beta = float(np.linalg.norm(w))
        k = len(alphas)
        tri = np.diag(alphas) + np.diag(betas, 1) + np.diag(betas, -1) if k > 1 else np.array([[a]])
        ev = np.linalg.eigvalsh(tri)
        if last is not None and abs(ev[0] - last) < tol:
            stable += 1
            if stable >= 5:
                break
        else:
            stable = 0
        last = ev[0]
        if beta < 1e-13:
            break
        betas.append(beta)
        v_prev, v = v, w / beta
    distinct = []
    for e in ev:
        if not distinct or abs(e - distinct[-1]) > 1e-8:
            distinct.append(float(e))
    return float(ev[0]), distinct[:6], it + 1

def run(job):
    kind, L, n, U, mode = job["lattice"], job["L"], job["n"], job["U"], job.get("mode", "lanczos")
    bonds = bonds_chain(L) if kind == "chain" else bonds_square(L)
    Ls = L if kind == "chain" else L * L
    t0 = time.time()
    states, T, D = hopping(Ls, n, bonds)
    dim = T.shape[0] ** 2
    mv = make_matvec(T, D, U)
    if mode == "eigsh":
        op = LinearOperator((dim, dim), matvec=mv, dtype=np.float64)
        vals = eigsh(op, k=job.get("k", 4), which="SA", ncv=job.get("ncv", 16), tol=1e-13, return_eigenvectors=False)
        vals = sorted(float(x) for x in vals)
        res = {"E0": vals[0], "lowest": vals, "iters": None}
    else:
        e0, distinct, iters = lanczos(mv, dim)
        res = {"E0": e0, "ritz_distinct_no_reorth": distinct, "iters": iters}
    res.update({"job": job, "dim": dim, "seconds": round(time.time() - t0, 1)})
    return res

if __name__ == "__main__":
    jobs = json.loads(sys.argv[1])
    outpath = sys.argv[2]
    for job in jobs:
        r = run(job)
        with open(outpath, "a") as f:
            f.write(json.dumps(r) + "\n")
        print(json.dumps(r), flush=True)
