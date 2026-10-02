#!/usr/bin/env python3
"""VE-exact-recompute (qmbl-verify 2026-09-29), Hubbard code A.
Factorised Hubbard matvec of qmbl checks/hubbard-u-labels/ed_check.py, imported from an unchanged copy (md5 printed in
the output): Psi[a, b] over (up configuration a, down configuration b), H Psi = T Psi + Psi T^T + U D o Psi, T the
one-species hopping matrix with its own Jordan-Wigner sign (operator order all-up then all-down), D[a, b] = number of
doubly occupied sites. Fixed N_up = N_dn = n, no lattice symmetry. Driven by scipy eigsh (ARPACK, which='SA') with
eigenvectors; the true residual ||Hx - Ex||/||x|| of the lowest Ritz vector is measured with one more matvec.
Note (2026-09-29): scipy's ARPACK indexes V(n, ncv) with 32-bit integers, so n * ncv must stay below 2^31 (the 4x4
half-filled sector, n = 1.66e8, crashed with ncv = 32: exit 139); --solver lanczos is a plain numpy Lanczos with a
second pass that rebuilds the Ritz vector, as a fallback."""
import argparse, hashlib, json, os, resource, socket, sys, time
ap = argparse.ArgumentParser()
ap.add_argument("--lattice", required=True, choices=["chain", "square"])
ap.add_argument("--L", type=int, required=True)
ap.add_argument("--n", type=int, required=True, help="N_up = N_dn")
ap.add_argument("--U", type=float, required=True)
ap.add_argument("--k", type=int, default=2)
ap.add_argument("--ncv", type=int, default=24)
ap.add_argument("--tol", type=float, default=1e-12)
ap.add_argument("--threads", type=int, default=8)
ap.add_argument("--seed", type=int, default=20260929)
ap.add_argument("--solver", default="arpack", choices=["arpack", "lanczos"])
ap.add_argument("--lanczos_tol", type=float, default=1e-10)
ap.add_argument("--instance", required=True)
ap.add_argument("--out", required=True)
args = ap.parse_args()
for v in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ[v] = str(args.threads)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy.sparse.linalg import eigsh, LinearOperator
import ed_check as E

t0 = time.time()
bonds = E.bonds_chain(args.L) if args.lattice == "chain" else E.bonds_square(args.L)
Ls = args.L if args.lattice == "chain" else args.L * args.L
assert len({tuple(sorted(b)) for b in bonds}) == len(bonds), "duplicate bonds"
states, T, D = E.hopping(Ls, args.n, bonds)
n = T.shape[0]; dim = n * n
mv0 = E.make_matvec(T, D, args.U)
count = [0]
def mv(x):
    count[0] += 1
    return mv0(x)
print(f"{args.instance}: Ls={Ls} n_up=n_dn={args.n} per-species dim {n} total {dim} nnz(T)={T.nnz} build {time.time()-t0:.1f}s", flush=True)
v0 = np.random.default_rng(args.seed).standard_normal(dim)
ts = time.time()
if args.solver == "arpack":
    if dim * args.ncv >= 2**31 - 1:
        raise SystemExit(f"n * ncv = {dim * args.ncv} >= 2^31: ARPACK's 32-bit indexing would overflow; lower --ncv")
    op = LinearOperator((dim, dim), matvec=mv, dtype=np.float64)
    vals, vecs = eigsh(op, k=args.k, which="SA", ncv=args.ncv, tol=args.tol, v0=v0, return_eigenvectors=True)
    order = np.argsort(vals); vals = vals[order]; vecs = vecs[:, order]
    x = np.ascontiguousarray(vecs[:, 0]); del vecs
else:
    from scipy.linalg import eigh_tridiagonal
    v = v0 / np.linalg.norm(v0); vp = np.zeros(dim); a, b = [], []; beta = 0.0; lam = None
    for it in range(3000):
        w = mv(v); al = float(v @ w); w -= al * v + beta * vp; a.append(al)
        beta_new = float(np.linalg.norm(w))
        if (it + 1) % 5 == 0:
            ev, sv = eigh_tridiagonal(np.array(a), np.array(b), select="i", select_range=(0, 0))
            lam = float(ev[0]); resEst = beta_new * abs(sv[-1, 0])
            print(f"  m={it + 1} E={lam:.14f} resEst={resEst:.2e}", flush=True)
            if resEst < args.lanczos_tol: break
        b.append(beta_new); vp, v = v, w / beta_new; beta = beta_new
    m = len(a); ev, sv = eigh_tridiagonal(np.array(a), np.array(b[: m - 1]), select="i", select_range=(0, 0)); s0 = sv[:, 0]
    x = np.zeros(dim); v = v0 / np.linalg.norm(v0); vp = np.zeros(dim); beta = 0.0
    for kk in range(m):
        x += s0[kk] * v
        if kk == m - 1: break
        w = mv(v); w -= a[kk] * v + beta * vp; vp, v = v, w / b[kk]; beta = b[kk]
    vals = np.array([float(ev[0])])
t_eig = time.time() - ts
hx = mv(x)
xx = float(x @ x); Eq = float(x @ hx) / xx
res = float(np.linalg.norm(hx - Eq * x)) / np.sqrt(xx)
out = dict(instance=args.instance, code="out/VE-exact-recompute/code/hub_fact.py + ed_check.py (qmbl checks/hubbard-u-labels, unchanged copy)",
           ed_check_md5=hashlib.md5(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "ed_check.py"), "rb").read()).hexdigest(),
           hamiltonian=f"-t sum_<ij>,s (c+_is c_js + h.c.) + U sum_i n_i,up n_i,dn, t=1, U={args.U!r}",
           geometry=f"{args.lattice} L={args.L} pbc ({len(bonds)} bonds, ed_check.bonds_{args.lattice})",
           sector=f"N_up = N_dn = {args.n}, no spatial symmetry", dim=dim, per_species_dim=n,
           solver=args.solver, eigsh=dict(k=args.k, ncv=args.ncv, tol=args.tol, which="SA", eigenvalues=[float(v) for v in vals]) if args.solver == "arpack" else None,
           lanczos=dict(tol_resEst=args.lanczos_tol, eigenvalue=float(vals[0])) if args.solver == "lanczos" else None,
           E0=float(vals[0]), E_rayleigh=Eq, residual=res, matvecs=count[0], seconds_eigsh=round(t_eig, 1),
           seconds=round(time.time() - t0, 1), peak_rss_GB=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6, 2),
           host=socket.gethostname(), threads=args.threads, command=" ".join(sys.argv))
print(json.dumps({kk: out[kk] for kk in ("E0", "E_rayleigh", "residual", "matvecs", "seconds")}), flush=True)
tmp = args.out + ".tmp"
with open(tmp, "w") as f:
    json.dump(out, f, indent=1)
os.replace(tmp, args.out)
