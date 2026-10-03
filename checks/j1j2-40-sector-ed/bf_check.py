#!/usr/bin/env python3
"""E1 brute-force sector check, independent of ed40.py: spin-1/2 J1-J2 model (Pauli, H = sum_NN s.s + J2 sum_NNN s.s) on a
small tilted square cluster. Full S^z = 0 basis (sorted integers, index by searchsorted), sparse H (scipy), explicit
projector P = |G|^-1 sum_g chi(g) U_g over G = translations x C4 x spin flip (site bookkeeping by fractional coordinates,
not ed40.py's Smith-form labels), lowest eigenvalue of P H P by ARPACK from a projected random start. Also: sector
dimensions Tr P (fixed points per element) and the unprojected ground state."""
import argparse, json, math, time
import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as sla


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--L1", default="4,2")
    ap.add_argument("--L2", default="-2,4")
    ap.add_argument("--J2", default="0.5,0.55,0.6,1")
    ap.add_argument("--out", required=True)
    ap.add_argument("--sectors", default="A,B", help="A, B (C4 rotation -> -1), E (C2 subgroup, C2 rotation -> -1 = the C4 E pair)")
    args = ap.parse_args()
    t0 = time.time()
    L1 = tuple(int(x) for x in args.L1.split(",")); L2 = tuple(int(x) for x in args.L2.split(","))
    M = np.array([L1, L2], float); N = int(round(abs(np.linalg.det(M)))); Minv = np.linalg.inv(M)

    def key(x):
        c = np.asarray(x, float) @ Minv
        c = np.round((c - np.floor(c)) * N).astype(np.int64) % N
        return (int(c[0]), int(c[1]))

    R = abs(L1[0]) + abs(L1[1]) + abs(L2[0]) + abs(L2[1])
    sites = {}
    for x in range(-R, R + 1):
        for y in range(-R, R + 1):
            kk = key((x, y))
            if kk not in sites or abs(x) + abs(y) < abs(sites[kk][0]) + abs(sites[kk][1]):
                sites[kk] = (x, y)
    assert len(sites) == N
    keys = sorted(sites); idx = {kk: i for i, kk in enumerate(keys)}
    pos = np.array([sites[kk] for kk in keys], np.int64)
    site = lambda x: idx[key(x)]
    o = site((0, 0))
    bonds = []
    for i in range(N):
        for d, J in (((1, 0), "J1"), ((0, 1), "J1"), ((1, 1), "J2"), ((1, -1), "J2")):
            bonds.append((i, site(pos[i] + np.array(d)), J))
    allst = np.arange(1 << N, dtype=np.int64)
    pc = np.zeros_like(allst)
    for i in range(N):
        pc += (allst >> i) & 1
    states = allst[pc == N // 2]; D = len(states)
    del allst, pc

    def index(arr):
        j = np.searchsorted(states, arr)
        assert np.all(states[j] == arr)
        return j

    full = (1 << N) - 1
    R90 = np.array([[0, -1], [1, 0]], np.int64)
    rot = [np.array([site(np.linalg.matrix_power(R90, m) @ (pos[i] - pos[o])) for i in range(N)]) for m in range(4)]
    trans = [np.array([site(pos[i] + pos[t] - pos[o]) for i in range(N)]) for t in range(N)]

    def img(perm):
        out = np.zeros(D, np.int64)
        for i in range(N):
            out |= ((states >> i) & 1) << int(perm[i])
        return out

    idxs = []; rotm = []
    for m in range(4):
        for t in range(N):
            perm = trans[t][rot[m]]
            im = img(perm)
            idxs.append(index(im)); rotm.append(m)
            idxs.append(index(im ^ full)); rotm.append(m)
    idxs = np.array(idxs); rotm = np.array(rotm); G = len(idxs)
    allchars = {"A": np.ones(G), "B": np.where(rotm % 2 == 1, -1.0, 1.0),
                # E: the C2 subgroup only (m = 0, 2), character -1 on the pi rotation; the factor 2 turns proj()'s 1/|G| into
                # the subgroup's 1/|G_C2|. Its range is the C4 E pair (C4 characters +-i), i.e. ed40b.py --group c2, sector B.
                "E": np.where(rotm == 0, 2.0, np.where(rotm == 2, -2.0, 0.0))}
    chars = {s: allchars[s] for s in args.sectors.split(",")}
    ar = np.arange(D)
    fixed = np.array([(idxs[g] == ar).sum() for g in range(G)], np.float64)
    dims = {s: int(round((chars[s] * fixed).sum() / G)) for s in chars}

    def proj(v, chi):
        out = np.zeros(D)
        for g in range(G):
            out += chi[g] * v[idxs[g]]
        return out / G

    def build_H(J2):
        diag = np.zeros(D); rr = [ar]; cc = [ar]; dd = []
        for (i, j, Jn) in bonds:
            J = 1.0 if Jn == "J1" else J2
            bi = (states >> i) & 1; bj = (states >> j) & 1
            par = bi == bj
            diag += np.where(par, J, -J)
            anti = np.nonzero(~par)[0]
            rr.append(index(states[anti] ^ ((1 << i) | (1 << j)))); cc.append(anti); dd.append(np.full(len(anti), 2.0 * J))
        return sp.csr_matrix((np.concatenate([diag] + dd), (np.concatenate(rr), np.concatenate(cc))), shape=(D, D))

    rng = np.random.default_rng(5)
    out = dict(code="handoff/e1/code/bf_check.py", N=N, L1=list(L1), L2=list(L2), Sz0_dimension=D, group_order=G, dims=dims, results=[])
    for J2 in [float(x) for x in args.J2.split(",")]:
        H = build_H(J2)
        assert abs(H - H.T).max() < 1e-12
        e_full = float(sla.eigsh(H, k=1, which="SA", tol=1e-13)[0][0])
        row = dict(J2=J2, E_full_space=e_full)
        for s, chi in chars.items():
            op = sla.LinearOperator((D, D), matvec=lambda x, chi=chi: proj(H @ proj(x, chi), chi), dtype=np.float64)
            v0 = proj(rng.standard_normal(D), chi)
            w, v = sla.eigsh(op, k=1, which="SA", v0=v0, tol=1e-13)
            x = v[:, 0]; hx = H @ x
            row[s] = float(w[0]); row[s + "_residual"] = float(np.linalg.norm(hx - w[0] * x) / np.linalg.norm(x))
            row[s + "_leak"] = float(np.linalg.norm(x - proj(x, chi)) / np.linalg.norm(x))
        out["results"].append(row)
        print(json.dumps(row), flush=True)
    out["seconds"] = round(time.time() - t0, 1)
    json.dump(out, open(args.out, "w"), indent=1)
    print("BF_DONE dims", dims, flush=True)


if __name__ == "__main__":
    main()
