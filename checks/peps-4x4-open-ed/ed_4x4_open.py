# Lanczos ED of the S=1/2 Heisenberg AFM H = sum_<ij> S_i.S_j on a 4x4 OPEN square (Sz=0 sector),
# to check the S.S convention of arXiv:1611.09467 Table I "Exact" = -0.57432544 per site.
import itertools, numpy as np, scipy.sparse as sp
from scipy.sparse.linalg import eigsh
Lx, Ly = 4, 4
N = Lx*Ly
bonds = []
for x in range(Lx):
    for y in range(Ly):
        i = x*Ly + y
        if x+1 < Lx: bonds.append((i, (x+1)*Ly + y))
        if y+1 < Ly: bonds.append((i, x*Ly + y+1))
assert len(bonds) == 2*Lx*Ly - Lx - Ly
states = [s for s in range(1 << N) if bin(s).count("1") == N//2]
idx = {s: k for k, s in enumerate(states)}
rows, cols, vals = [], [], []
for k, s in enumerate(states):
    diag = 0.0
    for i, j in bonds:
        bi, bj = (s >> i) & 1, (s >> j) & 1
        if bi == bj:
            diag += 0.25
        else:
            diag -= 0.25
            t = s ^ (1 << i) ^ (1 << j)
            rows.append(k); cols.append(idx[t]); vals.append(0.5)
    rows.append(k); cols.append(k); vals.append(diag)
H = sp.csr_matrix((vals, (rows, cols)), shape=(len(states), len(states)))
e = eigsh(H, k=1, which="SA", return_eigenvectors=False, tol=1e-12)[0]
print("dim", len(states), "bonds", len(bonds))
print("E0 total (S.S units) = %.10f ; per site = %.10f ; per bond = %.10f" % (e, e/N, e/len(bonds)))
print("paper Table I Exact 4x4 = -0.57432544 ; diff per site = %.2e" % (e/N + 0.57432544))
