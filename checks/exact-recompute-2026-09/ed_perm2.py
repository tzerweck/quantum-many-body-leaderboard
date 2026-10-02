#!/usr/bin/env python3
"""VE-exact-recompute (qmbl-verify 2026-09-29) ed_perm2.py: symmetry-resolved Lanczos for spin-1/2 Heisenberg clusters
given as a cluster file (code/clusters/*.json from gen_clusters.mjs: N, bonds, positions, supercell, point_group).
Kernels (table passes, stabilisers, matvec) are imported unchanged from E2's ed_perm.py; Lanczos and the basis from E2's
ed_sym.py. New here: the cluster group = all affine maps x -> R x + t (R in the given point-group matrices, t mapping site 0
to any site) that permute the sites modulo the supercell and map the bond set onto itself, found by brute force; the
bond list is cross-checked against a real-space nearest-neighbour search (kagome metric dx^2 + dx dy + dy^2 = 1).
Group G = automorphisms x spin inversion (bit complement, no phase: a singlet on N/2 pairs has z = (-1)^(N/2)).
Sectors: every real 1D character of G found from +-1 assignments on a generating set (homomorphism checked on all
pairs), i.e. momenta with real characters (Gamma and zone-boundary points with 2k = 0) and 1D point-group irreps.
Pauli H = sum_b sigma_i.sigma_j."""
import argparse, itertools, json, math, os, resource, socket, sys, time
import numpy as np
import numba as nb
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ed_sym import build_basis, lanczos
from ed_perm import pass1, pass2, pass3, finalize, stabilizers, matvec


def make_reducer(sup):
    sup = np.array(sup, dtype=np.int64)
    det = int(round(np.linalg.det(sup))); ad = abs(det)
    adj = np.round(np.linalg.inv(sup) * ad).astype(np.int64)
    assert np.array_equal(adj @ sup, ad * np.eye(len(sup), dtype=np.int64)), "adjugate check failed"
    def red(x):
        f = (np.asarray(x, np.int64) @ adj) % ad
        return tuple(int(v) for v in f)
    return red


def cluster_group(C):
    N = C["N"]; pos = np.array(C["positions"], np.int64); sup = np.array(C["supercell"], np.int64)
    red = make_reducer(sup)
    key = {red(p): i for i, p in enumerate(pos)}
    assert len(key) == N, "positions not distinct modulo the supercell"
    bset = {tuple(sorted(map(int, b))) for b in C["bonds"]}
    assert len(bset) == len(C["bonds"]), "duplicate bonds in cluster file"
    gcheck = {}
    if C.get("lattice") == "kagome":
        q = lambda d: int(d[0] * d[0] + d[0] * d[1] + d[1] * d[1])
        shifts = [a * sup[0] + b * sup[1] for a in range(-2, 3) for b in range(-2, 3)]
        nn = set()
        for i in range(N):
            for j in range(i + 1, N):
                if min(q(pos[j] - pos[i] + s) for s in shifts) == 1: nn.add((i, j))
        gcheck = dict(realspace_nn_bonds=len(nn), file_bonds=len(bset), identical=(nn == bset))
        if nn != bset: raise SystemExit("bond list differs from the real-space nearest neighbours: %s" % gcheck)
    elems = []
    for R in C["point_group"]:
        R = np.array(R, np.int64)
        for j in range(N):
            t = pos[j] - R @ pos[0]
            perm = np.empty(N, np.int64); ok = True
            for i in range(N):
                k = key.get(red(R @ pos[i] + t))
                if k is None: ok = False; break
                perm[i] = k
            if not ok or len(set(perm.tolist())) != N: continue
            if {tuple(sorted((int(perm[a]), int(perm[b])))) for a, b in bset} != bset: continue
            elems.append((perm, R, t))
    uniq = {}
    for perm, R, t in elems: uniq.setdefault(perm.tobytes(), (perm, R, t))
    return gcheck, list(uniq.values())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cluster", required=True)
    ap.add_argument("--subgroup", default="full", help="full | trans (pure translations only)")
    ap.add_argument("--chars", default="all", help="all | gamma (characters trivial on translations) | comma list")
    ap.add_argument("--z", default="1,-1")
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--tol", type=float, default=1e-9)
    ap.add_argument("--maxiter", type=int, default=3000)
    ap.add_argument("--second_pass", type=int, default=1)
    ap.add_argument("--seed", type=int, default=20260915)
    args = ap.parse_args()
    os.makedirs(args.outdir, exist_ok=True)
    C = json.load(open(args.cluster))
    name = "Heisenberg__" + C["name"]
    N = C["N"]; bonds = [tuple(map(int, b)) for b in C["bonds"]]
    gcheck, elems = cluster_group(C)
    I2 = np.eye(2, dtype=np.int64)
    if args.subgroup == "trans":
        elems = [e for e in elems if np.array_equal(e[1], I2)]
    nP = len(elems)
    print(f"{C['name']}: N={N} bonds={len(bonds)} geometry check {gcheck}; automorphisms kept {nP} ({args.subgroup}); "
          f"translations {sum(1 for e in elems if np.array_equal(e[1], I2))}", flush=True)
    perms = np.array([e[0] for e in elems])
    ident = np.arange(N, dtype=np.int64)
    order = sorted(range(nP), key=lambda p: 0 if np.array_equal(perms[p], ident) else 1)
    perms = perms[order]; elems = [elems[p] for p in order]
    assert np.array_equal(perms[0], ident)
    key = {perms[p].tobytes(): p for p in range(nP)}
    comp = np.array([[key[perms[a][perms[b]].tobytes()] for b in range(nP)] for a in range(nP)])
    nG = 2 * nP
    gcomp = np.empty((nG, nG), np.int64)
    for a in range(nG):
        for b in range(nG):
            gcomp[a, b] = comp[a % nP, b % nP] + nP * ((a >= nP) ^ (b >= nP))
    inv = np.array([int(np.where(gcomp[g] == 0)[0][0]) for g in range(nG)], np.int64)
    gens = []; span = {0}
    while len(span) < nP:
        gens.append(next(p for p in range(nP) if p not in span))
        span = {0}; frontier = [0]
        while frontier:
            nxt = []
            for x in frontier:
                for gg in gens:
                    y = int(comp[gg, x])
                    if y not in span: span.add(y); nxt.append(y)
            frontier = nxt
    words = {0: []}; frontier = [0]
    while frontier:
        nxt = []
        for x in frontier:
            for gi, gg in enumerate(gens):
                y = int(comp[gg, x])
                if y not in words: words[y] = [gi] + words[x]; nxt.append(y)
        frontier = nxt
    assert len(words) == nP
    chars = []
    for signs in itertools.product([1, -1], repeat=len(gens)):
        chiP = np.array([np.prod([signs[gi] for gi in words[p]]) if words[p] else 1 for p in range(nP)], np.float64)
        if np.all(chiP[:, None] * chiP[None, :] == chiP[comp]): chars.append(chiP)
    is_T = np.array([np.array_equal(e[1], I2) for e in elems])
    def describe(chiP):
        d = {"translations": "all +1" if np.all(chiP[is_T] == 1) else "mixed (k != 0, 2k = 0)"}
        byR = {}
        for p, (perm, R, t) in enumerate(elems):
            byR.setdefault(str(R.tolist()), set()).add(int(chiP[p]))
        d["by_point_group_matrix"] = {k: sorted(v) for k, v in byR.items()}
        return d
    print(f"|P|={nP} |G|={nG} generators={len(gens)} real 1D characters={len(chars)}", flush=True)
    if args.chars == "all": idx = list(range(len(chars)))
    elif args.chars == "gamma": idx = [c for c in range(len(chars)) if np.all(chars[c][is_T] == 1)]
    else: idx = [int(x) for x in args.chars.split(",")]
    for c in idx: print(f"  char {c}: {describe(chars[c])}", flush=True)
    B = build_basis(N, N // 2)
    D = B["D"]; nbytes = (N + 7) // 8
    ptab = np.zeros((nP, nbytes, 256), np.int64)
    for p in range(nP):
        for byte in range(nbytes):
            for val in range(256):
                x = 0
                for bit in range(8):
                    i = 8 * byte + bit
                    if i < N and (val >> bit) & 1: x |= 1 << int(perms[p][i])
                ptab[p, byte, val] = x
    full = (1 << N) - 1
    print(f"S^z=0 dimension {D}; table {D * 8 / 1e9:.2f} GB", flush=True)
    tb = time.time()
    tab = np.empty(D, np.int64); counts = np.zeros(len(B["hiList"]), np.int64)
    pass1(tab, counts, B["hiList"], B["startH"], B["lowSorted"], B["lowStart"], N // 2, B["nL"], ptab, nbytes, nP, full)
    nrep = int(counts.sum()); offsets = np.concatenate([[0], np.cumsum(counts)[:-1]]).astype(np.int64)
    reps = np.empty(nrep, np.int64)
    pass2(tab, reps, offsets, B["hiList"], B["startH"], B["rankL"], B["lowSorted"], B["lowStart"], N // 2, B["nL"])
    pass3(tab, B["hiList"], B["startH"], B["rankL"], B["lowSorted"], B["lowStart"], N // 2, B["nL"], ptab, nbytes, nP, full, inv)
    finalize(tab, reps, B["startH"], B["rankL"], B["nL"])
    tbuild = time.time() - tb
    print(f"table: {nrep} orbits in {tbuild:.0f}s", flush=True)
    bmask = np.array([(1 << i) | (1 << j) for i, j in bonds], np.int64)
    cdiag = np.ones(len(bonds)); amp = 2.0 * np.ones(len(bonds))
    summ = os.path.join(args.outdir, f"{name}__{args.subgroup}__summary.jsonl")
    for ci in idx:
        for zc in [int(z) for z in args.z.split(",")]:
            fname = f"{name}__{args.subgroup}-char{ci}__z{'+' if zc > 0 else '-'}"
            outp = os.path.join(args.outdir, fname + ".json")
            if os.path.exists(outp): print("skip", fname, flush=True); continue
            chi = np.concatenate([chars[ci], zc * chars[ci]])
            assert np.all(chi[:, None] * chi[None, :] == chi[gcomp])
            stab = np.empty(nrep, np.int64); chisum = np.empty(nrep)
            stabilizers(reps, chi, ptab, nbytes, nP, full, stab, chisum)
            valid = np.abs(chisum - stab) < 1e-9
            dim = int(valid.sum()); sq = np.sqrt(stab.astype(np.float64))
            desc = describe(chars[ci])
            print(f"== char {ci} {desc['translations']} z={zc}: dim={dim}", flush=True)
            ts = time.time()
            rec = dict(instance_name=name, cluster=args.cluster, cluster_vectors=[C.get("a"), C.get("b")], subgroup=args.subgroup,
                       group_order_without_spin_flip=nP, char_index=ci, characters=desc, spin_inversion=zc, sector_dimension=dim,
                       Sz0_dimension=D, geometry_check=gcheck, n_bonds=len(bonds))
            if dim:
                mv = lambda v, w: matvec(v, w, reps, valid, sq, tab, chi, B["startH"], B["rankL"], B["nL"], bmask, cdiag, amp)
                res = lanczos(mv, nrep, valid, np.float64, args.tol, args.maxiter, 5, args.seed, args.second_pass,
                              os.path.join(args.outdir, fname + ".progress.jsonl"), time.time())
                rec.update(res)
            else:
                rec["E"] = None
            rec.update(seconds_sector=round(time.time() - ts, 1), seconds_table_build=round(tbuild, 1),
                       peak_rss_GB=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6, 2), host=socket.gethostname(),
                       numba_threads=nb.get_num_threads(), command=" ".join(sys.argv), code="out/VE-exact-recompute/code/ed_perm2.py",
                       hamiltonian="Pauli, H = sum_b sigma_i.sigma_j (J = 1), S^z_tot = 0")
            print(f"   E={rec.get('E')} ritz={rec.get('E_ritz')} res={rec.get('residual')} it={rec.get('iterations')} t={rec['seconds_sector']}s", flush=True)
            with open(outp + ".tmp", "w") as f: json.dump(rec, f, indent=1)
            os.replace(outp + ".tmp", outp)
            with open(summ, "a") as f:
                f.write(json.dumps({k: rec.get(k) for k in ["char_index", "spin_inversion", "sector_dimension", "E", "E_ritz", "residual", "iterations", "seconds_sector"]} | {"translations": desc["translations"]}) + "\n")
    print("ALL_DONE", flush=True)


if __name__ == "__main__":
    main()
