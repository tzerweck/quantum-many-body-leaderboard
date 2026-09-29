#!/usr/bin/env python3
"""E2-exact-remote: symmetry-resolved Lanczos for spin-1/2 Heisenberg clusters with a general site-permutation group.

Used for Heisenberg/pyrochlore-2x2x2_32_P: sites and bonds exactly as ed_full.pyrochlore_stdface (StdFace Pyrochlore.c,
= arXiv:2101.08787 eq. (3) cluster 4x2^3). The cluster symmetry group is found by brute force over affine maps
x -> R x + t (R in the 48 signed permutation matrices, t mapping site 0 to any site) that map sites to sites modulo the
supercell and bonds to bonds; a real-space nearest-neighbour bond list is cross-checked against the StdFace list.
Group G = automorphisms x spin inversion. 1D real characters of G are enumerated from ±1 assignments on a generating set
(homomorphism checked on all pairs). Table and matvec as in ed_sym.py (tab[rank] = orbit | g_s << 40, s = g_s(rep)).
"""
import argparse, itertools, json, math, os, resource, socket, sys, time
import numpy as np
import numba as nb
from numba import njit, prange

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ed_full import pyrochlore_stdface
from ed_sym import build_basis, popcnt64, lanczos


def pyro_positions(W):
    """integer positions (units a/4) of pyrochlore_stdface(W, W, W) sites, same index order"""
    direct = np.array([[0, 2, 2], [2, 0, 2], [2, 2, 0]])  # 4 * (Wx..Hz)
    tau2 = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]])  # 2 * tau (fractional)
    pos = []
    for iw in range(W):
        for il in range(W):
            for ih in range(W):
                for a in range(4):
                    frac2 = 2 * np.array([iw, il, ih]) + tau2[a]
                    pos.append((frac2 @ direct) // 2)
    return np.array(pos, dtype=np.int64), direct * W  # supercell vectors as rows


def make_reducer(sup):
    sup = np.array(sup, dtype=np.int64)
    det = int(round(np.linalg.det(sup)))
    adj = np.round(np.linalg.inv(sup) * det).astype(np.int64)  # adjugate-like integer matrix: x @ adj / det = fractional
    def red(x):
        f = (np.asarray(x, np.int64) @ adj) % det  # fractional * det, mod det
        return tuple(int(v) for v in f)
    return red


def cluster_group(W):
    N, bonds, info = pyrochlore_stdface(W, W, W)
    pos, sup = pyro_positions(W)
    red = make_reducer(sup)
    key = {red(p): i for i, p in enumerate(pos)}
    assert len(key) == N, "positions not distinct modulo the supercell"
    bset = {tuple(sorted(b)) for b in bonds}
    # real-space NN cross-check: minimum image distance^2 = 2 (units a/4 -> |(0,1,1)|^2)
    nn = set()
    shifts = [np.array(c) @ sup for c in itertools.product([-1, 0, 1], repeat=3)]
    for i in range(N):
        for j in range(i + 1, N):
            d2 = min(int(((pos[j] - pos[i] + s) ** 2).sum()) for s in shifts)
            if d2 == 2: nn.add((i, j))
    geometry_check = dict(realspace_nn_bonds=len(nn), stdface_bonds=len(bset), identical=(nn == bset))
    mats = []
    for perm in itertools.permutations(range(3)):
        for signs in itertools.product([1, -1], repeat=3):
            R = np.zeros((3, 3), np.int64)
            for r in range(3): R[r, perm[r]] = signs[r]
            mats.append(R)
    elems = []
    for R in mats:
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
    return N, bonds, info, geometry_check, list(uniq.values())


@njit(inline="always")
def apply_perm(ptab, g, s, nbytes):
    x = np.int64(0)
    for byte in range(nbytes):
        x |= ptab[g, byte, (s >> (8 * byte)) & 255]
    return x


@njit(parallel=True, cache=True)
def pass1(tab, counts, hiList, startH, lowSorted, lowStart, k, nL, ptab, nbytes, nP, full):
    for t in prange(hiList.shape[0]):
        hi = hiList[t]; q = k - popcnt64(hi)
        base = startH[hi]; l0 = lowStart[q]; n = lowStart[q + 1] - l0
        cnt = 0
        for jj in range(n):
            s = (hi << nL) | lowSorted[l0 + jj]
            best = s; bestg = 0
            for p in range(nP):
                x = apply_perm(ptab, p, s, nbytes)
                if x < best: best = x; bestg = p
                y = x ^ full
                if y < best: best = y; bestg = nP + p
            if best == s:
                cnt += 1; tab[base + jj] = -1
            else:
                tab[base + jj] = bestg
        counts[t] = cnt


@njit(parallel=True, cache=True)
def pass2(tab, reps, offsets, hiList, startH, rankL, lowSorted, lowStart, k, nL):
    for t in prange(hiList.shape[0]):
        hi = hiList[t]; q = k - popcnt64(hi)
        base = startH[hi]; l0 = lowStart[q]; n = lowStart[q + 1] - l0
        ri = offsets[t]
        for jj in range(n):
            if tab[base + jj] == -1:
                tab[base + jj] = -(ri + 1)
                reps[ri] = (hi << nL) | lowSorted[l0 + jj]
                ri += 1


@njit(parallel=True, cache=True)
def pass3(tab, hiList, startH, rankL, lowSorted, lowStart, k, nL, ptab, nbytes, nP, full, inv):
    maskL = (np.int64(1) << nL) - 1
    for t in prange(hiList.shape[0]):
        hi = hiList[t]; q = k - popcnt64(hi)
        base = startH[hi]; l0 = lowStart[q]; n = lowStart[q + 1] - l0
        for jj in range(n):
            e = tab[base + jj]
            if e < 0: continue
            s = (hi << nL) | lowSorted[l0 + jj]
            x = apply_perm(ptab, e % nP, s, nbytes)
            if e >= nP: x ^= full
            r = startH[x >> nL] + rankL[x & maskL]
            tab[base + jj] = (-tab[r] - 1) | (inv[e] << 40)


@njit(parallel=True, cache=True)
def finalize(tab, reps, startH, rankL, nL):
    maskL = (np.int64(1) << nL) - 1
    for i in prange(reps.shape[0]):
        s = reps[i]; tab[startH[s >> nL] + rankL[s & maskL]] = i


@njit(parallel=True, cache=True)
def stabilizers(reps, chi, ptab, nbytes, nP, full, stab, chisum):
    for i in prange(reps.shape[0]):
        s = reps[i]; c = 0; sm = 0.0
        for p in range(nP):
            x = apply_perm(ptab, p, s, nbytes)
            if x == s: c += 1; sm += chi[p]
            if (x ^ full) == s: c += 1; sm += chi[nP + p]
        stab[i] = c; chisum[i] = sm


@njit(parallel=True, cache=True)
def matvec(v, out, reps, valid, sq, tab, chic, startH, rankL, nL, bmask, cdiag, amp):
    maskL = (np.int64(1) << nL) - 1
    nb_ = bmask.shape[0]
    for i in prange(reps.shape[0]):
        if not valid[i]:
            out[i] = 0.0; continue
        r = reps[i]; d = 0.0; acc = 0.0; inv_sqi = 1.0 / sq[i]
        for b in range(nb_):
            m = bmask[b]; x = r & m
            if x == 0 or x == m:
                d += cdiag[b]
            else:
                d -= cdiag[b]
                s = r ^ m
                e = tab[startH[s >> nL] + rankL[s & maskL]]
                j = e & 0xFFFFFFFFFF; g = e >> 40
                acc += (amp[b] * sq[j] * inv_sqi) * chic[g] * v[j]
        out[i] = acc + d * v[i]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--W", type=int, default=2)
    ap.add_argument("--subgroup", default="full", help="full | abelian (translations x site inversion) | trans")
    ap.add_argument("--irreps", default="all")
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--name", default="Heisenberg__pyrochlore-2x2x2_32_P")
    ap.add_argument("--tol", type=float, default=1e-9)
    ap.add_argument("--maxiter", type=int, default=3000)
    ap.add_argument("--second_pass", type=int, default=1)
    ap.add_argument("--seed", type=int, default=20260915)
    args = ap.parse_args()
    os.makedirs(args.outdir, exist_ok=True)
    t0 = time.time()
    N, bonds, ginfo, gcheck, elems = cluster_group(args.W)
    print(f"N={N} bonds={len(bonds)} geometry check {gcheck}; cluster automorphisms (affine) found: {len(elems)}", flush=True)
    if not gcheck["identical"]: raise SystemExit("StdFace bonds differ from real-space nearest neighbours")
    if args.subgroup != "full":
        keep = []
        for perm, R, t in elems:
            if args.subgroup == "trans" and np.array_equal(R, np.eye(3, dtype=np.int64)): keep.append((perm, R, t))
            if args.subgroup == "abelian" and (np.array_equal(R, np.eye(3, dtype=np.int64)) or np.array_equal(R, -np.eye(3, dtype=np.int64))): keep.append((perm, R, t))
        elems = keep
    nP = len(elems)
    perms = np.array([e[0] for e in elems])
    key = {perms[p].tobytes(): p for p in range(nP)}
    comp = np.array([[key[perms[a][perms[b]].tobytes()] for b in range(nP)] for a in range(nP)])
    assert (comp[:, :] >= 0).all()
    idp = key[np.arange(N, dtype=np.int64).tobytes()]
    assert idp == 0 or True
    # put identity first
    order = [idp] + [p for p in range(nP) if p != idp]
    perms = perms[order]; elems = [elems[p] for p in order]
    key = {perms[p].tobytes(): p for p in range(nP)}
    comp = np.array([[key[perms[a][perms[b]].tobytes()] for b in range(nP)] for a in range(nP)])
    nG = 2 * nP
    # full group composition with spin flip: g = p (z=0) or nP + p (z=1)
    gcomp = np.empty((nG, nG), np.int64)
    for a in range(nG):
        for b in range(nG):
            gcomp[a, b] = comp[a % nP, b % nP] + nP * ((a >= nP) ^ (b >= nP))
    inv = np.array([int(np.where(gcomp[g] == 0)[0][0]) for g in range(nG)], np.int64)
    # generating set of the permutation group and 1D real characters
    gens = []
    span = {0}
    while len(span) < nP:
        cand = next(p for p in range(nP) if p not in span)
        gens.append(cand)
        frontier = list(span)
        span = set(span)
        changed = True
        while changed:
            changed = False
            for x in list(span):
                for gg in gens:
                    y = comp[gg, x]
                    if y not in span: span.add(y); changed = True
    words = {0: []}
    frontier = [0]
    while frontier:
        nxt = []
        for x in frontier:
            for gi, gg in enumerate(gens):
                y = comp[gg, x]
                if y not in words: words[y] = [gi] + words[x]; nxt.append(y)
        frontier = nxt
    chars = []
    for signs in itertools.product([1, -1], repeat=len(gens)):
        chiP = np.array([np.prod([signs[gi] for gi in words[p]]) if words[p] else 1 for p in range(nP)], np.float64)
        if np.all(chiP[:, None] * chiP[None, :] == chiP[comp]): chars.append(chiP)
    # describe each character by its values on translations, inversion about site 0 and a C3 axis through site 0
    I3 = np.eye(3, dtype=np.int64)
    desc_elems = {}
    for p, (perm, R, t) in enumerate(elems):
        if np.array_equal(R, I3) and p != 0: desc_elems.setdefault("T" + str(tuple(int(x) for x in t)), p)
        if np.array_equal(R, -I3) and perm[0] == 0: desc_elems.setdefault("inversion@site0", p)
        if np.array_equal(R, np.array([[0, 0, 1], [1, 0, 0], [0, 1, 0]])) and perm[0] == 0: desc_elems.setdefault("C3[111]@site0", p)
    print(f"|P|={nP} |G|={nG} generators={len(gens)} 1D real characters={len(chars)} (x spin inversion +-1)", flush=True)
    B = build_basis(N, N // 2)
    D = B["D"]
    nbytes = (N + 7) // 8
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
    idx = range(len(chars)) if args.irreps == "all" else [int(x) for x in args.irreps.split(",")]
    summ = os.path.join(args.outdir, f"{args.name}__{args.subgroup}__summary.jsonl")
    for ci in idx:
        for zc in (1, -1):
            fname = f"{args.name}__{args.subgroup}-char{ci}__z{'+' if zc > 0 else '-'}"
            outp = os.path.join(args.outdir, fname + ".json")
            if os.path.exists(outp): print("skip", fname); continue
            chi = np.concatenate([chars[ci], zc * chars[ci]])
            assert np.all(chi[:, None] * chi[None, :] == chi[gcomp])
            stab = np.empty(nrep, np.int64); chisum = np.empty(nrep)
            stabilizers(reps, chi, ptab, nbytes, nP, full, stab, chisum)
            valid = np.abs(chisum - stab) < 1e-9
            dim = int(valid.sum()); sq = np.sqrt(stab.astype(np.float64))
            cd = {nm: int(chars[ci][p]) for nm, p in desc_elems.items()}
            print(f"== char {ci} {cd} z={zc}: dim={dim}", flush=True)
            ts = time.time()
            rec = dict(instance_name=args.name, subgroup=args.subgroup, group_order_without_spin_flip=nP, char_index=ci, characters=cd,
                       spin_inversion=zc, sector_dimension=dim, Sz0_dimension=D, geometry_check=gcheck, geometry=ginfo)
            if dim:
                mv = lambda v, w: matvec(v, w, reps, valid, sq, tab, chi, B["startH"], B["rankL"], B["nL"], bmask, cdiag, amp)
                res = lanczos(mv, nrep, valid, np.float64, args.tol, args.maxiter, 5, args.seed, args.second_pass,
                              os.path.join(args.outdir, fname + ".progress.jsonl"), time.time())
                rec.update(res)
            else:
                rec["E"] = None
            rec.update(seconds_sector=round(time.time() - ts, 1), seconds_table_build=round(tbuild, 1),
                       peak_rss_GB=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6, 2), host=socket.gethostname(),
                       numba_threads=nb.get_num_threads(), command=" ".join(sys.argv), code="out/E2-exact-remote/code/ed_perm.py")
            print(f"   E={rec.get('E')} res={rec.get('residual')} it={rec.get('iterations')} t={rec['seconds_sector']}s", flush=True)
            with open(outp + ".tmp", "w") as f: json.dump(rec, f, indent=1)
            os.replace(outp + ".tmp", outp)
            with open(summ, "a") as f:
                f.write(json.dumps({k: rec.get(k) for k in ["char_index", "characters", "spin_inversion", "sector_dimension", "E", "residual", "iterations", "seconds_sector"]}) + "\n")
    print("ALL_DONE", flush=True)


if __name__ == "__main__":
    main()
