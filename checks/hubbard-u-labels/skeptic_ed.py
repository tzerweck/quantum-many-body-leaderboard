# Skeptic's independent ED: 4x4 periodic Hubbard, N_up = N_dn = 5, t = 1,
# H = -t sum_<ij>,s (c+_is c_js + h.c.) + U sum_i n_iu n_id, no shift.
# psi stored as (up-config, dn-config) matrix; H psi = T psi + psi T + D * psi.
import sys, json, itertools
import numpy as np
import scipy.sparse as sp

L = 4
N = L * L
NP = 5

def site(x, y):
    return (x % L) + L * (y % L)

bonds = set()
for y in range(L):
    for x in range(L):
        r = site(x, y)
        for s in (site(x + 1, y), site(x, y + 1)):
            bonds.add((min(r, s), max(r, s)))
bonds = sorted(bonds)
assert len(bonds) == 32
deg = [0] * N
for a, b in bonds:
    deg[a] += 1; deg[b] += 1
assert all(d == 4 for d in deg)

states = [s for s in range(1 << N) if bin(s).count("1") == NP]
idx = {s: k for k, s in enumerate(states)}
M = len(states)
assert M == 4368

rows, cols, vals = [], [], []
for k, s in enumerate(states):
    for (i, j) in bonds:
        for (a, b) in ((i, j), (j, i)):  # c+_a c_b
            if (s >> b) & 1 and not (s >> a) & 1:
                lo, hi = min(a, b), max(a, b)
                between = bin(s & (((1 << hi) - 1) ^ ((1 << (lo + 1)) - 1))).count("1")
                sign = -1.0 if between % 2 else 1.0
                s2 = s ^ (1 << a) ^ (1 << b)
                rows.append(idx[s2]); cols.append(k); vals.append(-1.0 * sign)
T = sp.csr_matrix((vals, (rows, cols)), shape=(M, M))
assert abs(T - T.T).max() < 1e-15

st = np.array(states, dtype=np.int64)
dbl = np.zeros((M, M), dtype=np.float64)
for a in range(M):
    x = st[a] & st
    # popcount of 16-bit ints
    c = np.zeros(M, dtype=np.int64)
    for bit in range(N):
        c += (x >> bit) & 1
    dbl[a, :] = c

CH = 512

def apply_H(v, U):
    w = T @ v
    for a0 in range(0, M, CH):
        a1 = min(M, a0 + CH)
        w[a0:a1, :] += (T @ v[a0:a1, :].T).T
        w[a0:a1, :] += U * dbl[a0:a1, :] * v[a0:a1, :]
    return w

def lanczos(U, maxit=400, tol=1e-13, seed=1):
    rng = np.random.default_rng(seed)
    v = rng.standard_normal((M, M))
    v /= np.linalg.norm(v)
    vprev = None
    alphas, betas = [], []
    beta = 0.0
    last = None
    for it in range(maxit):
        w = apply_H(v, U)
        alpha = float(np.vdot(v, w))
        w -= alpha * v
        if vprev is not None:
            w -= beta * vprev
        alphas.append(alpha)
        beta = float(np.linalg.norm(w))
        betas.append(beta)
        vprev = v
        w /= beta
        v = w
        del w
        if it >= 10 and it % 5 == 0:
            from scipy.linalg import eigh_tridiagonal
            e = eigh_tridiagonal(np.array(alphas), np.array(betas[:-1]), eigvals_only=True, select='i', select_range=(0, 0))[0]
            if last is not None and abs(e - last) < tol:
                return e, it
            last = e
    return last, maxit

out = {}
for U in [float(u) for u in sys.argv[1:]]:
    e, it = lanczos(U)
    out[repr(U)] = {"E0": e, "iterations": it}
    print(json.dumps({"U": U, "E0": repr(e), "it": it}), flush=True)
