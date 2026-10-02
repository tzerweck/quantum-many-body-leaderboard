#!/usr/bin/env python3
"""VE-exact-recompute (qmbl-verify 2026-09-29) ed_full2.py = E2's ed_full.py (md5 53d82b84) with two added models;
the E2 models (tv_chain, tv_square, heis_square, heis_pyrochlore) and their kernel are unchanged.
  hubbard    : H = -t sum_<ij>,s (c+_is c_js + h.c.) + U sum_i n_i,up n_i,dn, t = 1, fixed (N_up, N_dn).
               Ns lattice sites -> 2 Ns spin-orbitals, up orbital i = bit i (low word), down orbital i = bit Ns + i (high
               word); operator order all-up then all-down, so each hop carries only its own species' Jordan-Wigner sign.
               The basis keeps only high words (down configurations) of popcount N_dn: D = C(Ns,N_up) C(Ns,N_dn).
               Diagonal U * popcount(up & down). Lattices: nk-Grid chain/square with pbc (same bonds as tv_*).
  heis_bonds : H = sum_b sigma_i . sigma_j (Pauli) on a bond list read from a JSON file ({"N":..,"bonds":[[i,j],..]}),
               S^z_tot = 0 (or --nup). Same kernel as heis_square.

Original E2 docstring:
Models (Hamiltonians identical to out/E1-exact-recompute/ed_lib.mjs, run_spins.mjs, run_fermions.mjs):
  heis  : H = sum_b J_b sigma_i . sigma_j (Pauli), S^z_tot = 0 (k = N/2 up spins)
  tv    : H = -t sum_<ij> (c+_i c_j + h.c.) + V sum_<ij> n_i n_j, spinless, Nf particles,
          Jordan-Wigner with ascending orbital order (sign = (-1)^(occupied sites strictly between i and j)).

Basis index = combinatorial rank computed from two half-word tables (no 2^N lookup):
  s = (hi << nL) | lo,  rank(s) = startH[hi] + rankL[lo]
where rankL[lo] is the rank of lo among nL-bit words of the same popcount (ascending) and startH[hi] is the
offset of the block of states with that high word. Parallel gather matvec (row-wise, each thread writes only its rows).
Plain Lanczos (no reorthogonalisation), convergence on beta_m |s_m|, optional second pass that rebuilds the
Ritz vector and measures the true residual ||Hx - Ex||/||x||.
"""
import argparse, json, math, os, resource, socket, sys, time
import numpy as np
import numba as nb
from numba import njit, prange


# ------------------------------------------------------------------ lattices
def unique_edges(edges):
    seen, out = set(), []
    for e in edges:
        i, j = min(e[0], e[1]), max(e[0], e[1])
        if i == j:
            raise ValueError("self loop")
        if (i, j) not in seen:
            seen.add((i, j)); out.append((i, j) + tuple(e[2:]))
    return out


def grid_edges(extent, pbc):
    """port of ed_lib.mjs gridEdges (nk.graph.Grid)."""
    edges = []
    if len(extent) == 1:
        L = extent[0]
        edges = [(i, i + 1) for i in range(L - 1)] + ([(L - 1, 0)] if pbc else [])
    else:
        L1, L2 = extent
        k = lambda i, j: (i % L1) * L2 + (j % L2)
        for i in range(L1):
            for j in range(L2):
                if i + 1 < L1 or pbc: edges.append((k(i, j), k(i + 1, j)))
                if j + 1 < L2 or pbc: edges.append((k(i, j), k(i, j + 1)))
    return unique_edges(edges)


def pyrochlore_stdface(W, L, H):
    """Bond list of programs/mVMC_RBM/src/StdFace/Pyrochlore.c (varbench/methods), box = diag(W, L, H).
    Site index = cell * 4 + isiteUC, cells ordered (iW, iL, iH) lexicographic. Each tuple (diW, diL, diH, isiteUC, jsiteUC)
    is one StdFace_FindSite call in section (5) of Pyrochlore.c, in source order."""
    calls = [(0, 0, 0, 0, 1), (0, 0, 0, 0, 2), (0, 0, 0, 0, 3), (0, 0, 0, 2, 3), (0, 0, 0, 3, 1), (0, 0, 0, 1, 2),
             (1, 0, 0, 1, 0), (0, 1, 0, 2, 0), (0, 0, 1, 3, 0), (0, -1, 1, 3, 2), (1, 0, -1, 1, 3), (-1, 1, 0, 2, 1)]
    cells = [(a, b, c) for a in range(W) for b in range(L) for c in range(H)]
    cid = {x: n for n, x in enumerate(cells)}
    direct = np.array([[0.0, 0.5, 0.5], [0.5, 0.0, 0.5], [0.5, 0.5, 0.0]])  # Wx..Hz defaults, a = 1
    tau = np.array([[0, 0, 0], [0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5]])
    bonds, dists = [], []
    for (iw, il, ih) in cells:
        for (dw, dl, dh, a, b) in calls:
            jc = ((iw + dw) % W, (il + dl) % L, (ih + dh) % H)
            i, j = cid[(iw, il, ih)] * 4 + a, cid[jc] * 4 + b
            bonds.append((i, j))
            # real-space distance (unfolded) as a geometry check
            ri = (np.array([iw, il, ih]) + tau[a]) @ direct
            rj = (np.array([iw + dw, il + dl, ih + dh]) + tau[b]) @ direct
            dists.append(float(np.linalg.norm(ri - rj)))
    u = unique_edges(bonds)
    N = 4 * len(cells)
    deg = np.zeros(N, int)
    for i, j in u: deg[i] += 1; deg[j] += 1
    info = dict(n_calls=len(bonds), unique_bonds=len(u), duplicates=len(bonds) - len(u),
                degrees=sorted(set(deg.tolist())), bond_lengths=sorted(set(round(d, 12) for d in dists)))
    return N, u, info


# ------------------------------------------------------------------ basis
def popcount_np(x):
    x = x.astype(np.int64)
    c = np.zeros_like(x)
    while np.any(x):
        c += x & 1; x >>= 1
    return c


def binom(n, k):
    return math.comb(n, k) if 0 <= k <= n else 0


def build_basis(N, k, hi_pop=None):
    """hi_pop (ed_full2): keep only high words of this popcount (Hubbard: fixed N_dn); None = E2 behaviour."""
    nL = N // 2
    nH = N - nL
    wL = np.arange(1 << nL, dtype=np.int64)
    pL = popcount_np(wL)
    orderL = np.lexsort((wL, pL))
    lowSorted = wL[orderL]
    lowStart = np.zeros(nL + 2, np.int64)
    for p in range(nL + 1): lowStart[p + 1] = lowStart[p] + binom(nL, p)
    rankL = np.empty(1 << nL, np.int64)
    rankL[orderL] = np.arange(1 << nL, dtype=np.int64) - lowStart[pL[orderL]]
    wH = np.arange(1 << nH, dtype=np.int64)
    pH = popcount_np(wH)
    startH = np.full(1 << nH, -1, np.int64)
    hiList = []
    off = 0
    for p in range(max(0, k - nL), min(nH, k) + 1):
        if hi_pop is not None and p != hi_pop:
            continue
        hs = wH[pH == p]  # ascending
        blk = binom(nL, k - p)
        startH[hs] = off + np.arange(len(hs), dtype=np.int64) * blk
        hiList.append(hs)
        off += len(hs) * blk
    D = off
    if hi_pop is None:
        assert D == binom(N, k)
    else:
        assert D == binom(nH, hi_pop) * binom(nL, k - hi_pop)
    hiList = np.concatenate(hiList).astype(np.int64)
    return dict(N=N, k=k, nL=nL, nH=nH, D=D, lowSorted=lowSorted, lowStart=lowStart, rankL=rankL, startH=startH, hiList=hiList)


# ------------------------------------------------------------------ kernels
@njit(inline="always")
def popcnt64(x):
    x = x - ((x >> 1) & 0x5555555555555555)
    x = (x & 0x3333333333333333) + ((x >> 2) & 0x3333333333333333)
    x = (x + (x >> 4)) & 0x0F0F0F0F0F0F0F0F
    return (x * 0x0101010101010101) >> 56


@njit(parallel=True, cache=True)
def matvec(v, out, hiList, startH, rankL, lowSorted, lowStart, k, nL, bmask, bbetween, c00, c11, cdiff, amp):
    nb_ = bmask.shape[0]
    maskL = (np.int64(1) << nL) - 1
    for t in prange(hiList.shape[0]):
        hi = hiList[t]
        q = k - popcnt64(hi)
        base = startH[hi]
        l0 = lowStart[q]
        n = lowStart[q + 1] - l0
        hs = hi << nL
        for j in range(n):
            s = hs | lowSorted[l0 + j]
            idx = base + j
            d = 0.0
            acc = 0.0
            for b in range(nb_):
                m = bmask[b]
                x = s & m
                if x == 0:
                    d += c00[b]
                elif x == m:
                    d += c11[b]
                else:
                    d += cdiff[b]
                    s2 = s ^ m
                    r = startH[s2 >> nL] + rankL[s2 & maskL]
                    if popcnt64(s & bbetween[b]) & 1:
                        acc -= amp[b] * v[r]
                    else:
                        acc += amp[b] * v[r]
            out[idx] = acc + d * v[idx]


@njit(parallel=True, cache=True)
def matvec_hub(v, out, hiList, startH, rankL, lowSorted, lowStart, k, nL, bmask, bbetween, amp, U):
    """ed_full2 Hubbard kernel: hopping bonds within one species (masks on 2 Ns spin-orbitals, JW sign from the
    occupied orbitals strictly between the two ends) + diagonal U * (number of doubly occupied sites)."""
    nb_ = bmask.shape[0]
    maskL = (np.int64(1) << nL) - 1
    for t in prange(hiList.shape[0]):
        hi = hiList[t]
        q = k - popcnt64(hi)
        base = startH[hi]
        l0 = lowStart[q]
        n = lowStart[q + 1] - l0
        hs = hi << nL
        for j in range(n):
            lo = lowSorted[l0 + j]
            s = hs | lo
            idx = base + j
            acc = 0.0
            for b in range(nb_):
                m = bmask[b]
                x = s & m
                if x != 0 and x != m:
                    s2 = s ^ m
                    r = startH[s2 >> nL] + rankL[s2 & maskL]
                    if popcnt64(s & bbetween[b]) & 1:
                        acc -= amp[b] * v[r]
                    else:
                        acc += amp[b] * v[r]
            out[idx] = acc + U * popcnt64(lo & hi) * v[idx]


@njit(parallel=True, cache=True)
def pdot(a, b):
    s = 0.0
    for i in prange(a.shape[0]):
        s += a[i] * b[i]
    return s


@njit(parallel=True, cache=True)
def lanczos_update(w, v, vp, alpha, beta):
    for i in prange(w.shape[0]):
        w[i] -= alpha * v[i] + beta * vp[i]


@njit(parallel=True, cache=True)
def div_into(dst, src, beta):
    for i in prange(dst.shape[0]):
        dst[i] = src[i] / beta


@njit(parallel=True, cache=True)
def axpy(y, a, x):
    for i in prange(y.shape[0]):
        y[i] += a * x[i]


@njit(parallel=True, cache=True)
def resid2(hx, x, E):
    s = 0.0
    for i in prange(x.shape[0]):
        r = hx[i] - E * x[i]
        s += r * r
    return s


@njit(parallel=True, cache=True)
def random_fill(v, seed, nblocks):
    D = v.shape[0]
    bs = (D + nblocks - 1) // nblocks
    for blk in prange(nblocks):
        x = np.uint64(seed) * np.uint64(0x9E3779B97F4A7C15) + np.uint64(blk + 1) * np.uint64(0xBF58476D1CE4E5B9)
        for i in range(blk * bs, min(D, (blk + 1) * bs)):
            x ^= x << np.uint64(13); x ^= x >> np.uint64(7); x ^= x << np.uint64(17)
            v[i] = (x >> np.uint64(11)) * (1.0 / 9007199254740992.0) - 0.5


@njit(parallel=True, cache=True)
def translation_overlap(x, hiList, startH, rankL, lowSorted, lowStart, k, nL, N, fermion):
    """<x| T |x> with T: site i -> i+1 mod N (fermions: sign (-1)^(k-1) when site N-1 is occupied)."""
    maskL = (np.int64(1) << nL) - 1
    full = (np.int64(1) << N) - 1
    tot = 0.0
    for t in prange(hiList.shape[0]):
        hi = hiList[t]
        q = k - popcnt64(hi)
        base = startH[hi]
        l0 = lowStart[q]
        n = lowStart[q + 1] - l0
        acc = 0.0
        for j in range(n):
            s = (hi << nL) | lowSorted[l0 + j]
            s2 = ((s << 1) | (s >> (N - 1))) & full
            r = startH[s2 >> nL] + rankL[s2 & maskL]
            sg = 1.0
            if fermion and ((s >> (N - 1)) & 1) and ((k - 1) & 1):
                sg = -1.0
            acc += sg * x[r] * x[base + j]
        tot += acc
    return tot


# ------------------------------------------------------------------ tridiagonal lowest eigenpair
def tridiag_lowest(a, b):
    from scipy.linalg import eigh_tridiagonal
    w, s = eigh_tridiagonal(np.array(a), np.array(b[: len(a) - 1]), select="i", select_range=(0, 0))
    return float(w[0]), s[:, 0]


# ------------------------------------------------------------------ driver
def build_model(args):
    info = {}
    if args.model == "tv_chain":
        N, Nf, V = args.L, args.Nf, args.V
        edges = grid_edges([N], True)
        k = Nf; fermion = True
        info["geometry"] = f"nk.graph.Grid(extent=[{N}], pbc=True): {len(edges)} bonds"
        info["hamiltonian"] = f"-t sum (c+_i c_j + h.c.) + V sum n_i n_j, t=1, V={V}, Nf={Nf} (total)"
    elif args.model == "tv_square":
        N, Nf, V = args.L * args.L, args.Nf, args.V
        edges = grid_edges([args.L, args.L], True)
        k = Nf; fermion = True
        info["geometry"] = f"nk.graph.Grid(extent=[{args.L},{args.L}], pbc=True): {len(edges)} bonds"
        info["hamiltonian"] = f"-t sum (c+_i c_j + h.c.) + V sum n_i n_j, t=1, V={V}, Nf={Nf} (total)"
    elif args.model == "heis_square":
        N = args.L * args.L
        edges = grid_edges([args.L, args.L], True)
        k = N // 2; fermion = False
        info["geometry"] = f"{args.L}x{args.L} torus nearest neighbours (nk Grid pbc): {len(edges)} bonds"
        info["hamiltonian"] = "Pauli, H = sum_b sigma_i.sigma_j, S^z_tot = 0"
    elif args.model == "heis_pyrochlore":
        N, edges, pinfo = pyrochlore_stdface(args.L, args.L, args.L)
        k = args.nup if args.nup else N // 2; fermion = False
        if pinfo["duplicates"] or pinfo["degrees"] != [6] or len(pinfo["bond_lengths"]) != 1:
            raise SystemExit("pyrochlore geometry check failed: " + json.dumps(pinfo))
        info["geometry"] = (f"StdFace Pyrochlore.c (varbench/methods programs/mVMC_RBM), W=L=H={args.L}: fcc W=(0,1/2,1/2) "
                            f"L=(1/2,0,1/2) H=(1/2,1/2,0), tau=(0,0,0),(1/2,0,0),(0,1/2,0),(0,0,1/2) fractional; "
                            f"{pinfo['n_calls']} FindSite bonds, {pinfo['unique_bonds']} unique, degrees {pinfo['degrees']}, "
                            f"bond lengths {pinfo['bond_lengths']}")
        info["hamiltonian"] = "Pauli, H = sum_b sigma_i.sigma_j, S^z_tot = %g" % (k - N / 2)
        info["bonds"] = edges
    elif args.model == "heis_bonds":  # ed_full2
        spec = json.load(open(args.bonds))
        N = int(spec["N"])
        raw = [tuple(int(x) for x in e[:2]) for e in spec["bonds"]]
        edges = unique_edges(raw)
        if len(edges) != len(raw):
            raise SystemExit(f"bond list {args.bonds} has {len(raw) - len(edges)} duplicate bonds")
        if max(max(e) for e in edges) >= N:
            raise SystemExit("bond index >= N")
        deg = np.zeros(N, int)
        for i, j in edges: deg[i] += 1; deg[j] += 1
        k = args.nup if args.nup else N // 2; fermion = False
        info["geometry"] = f"bond list {os.path.basename(args.bonds)} ({spec.get('name', '')}): N={N}, {len(edges)} bonds, degrees {sorted(set(deg.tolist()))}"
        info["cluster"] = {kk: vv for kk, vv in spec.items() if kk not in ("bonds", "positions")}
        info["hamiltonian"] = "Pauli, H = sum_b sigma_i.sigma_j, S^z_tot = %g" % (k - N / 2)
    elif args.model == "hubbard":  # ed_full2
        if args.lattice == "chain":
            Ns = args.L; lat = grid_edges([args.L], True)
        elif args.lattice == "square":
            Ns = args.L * args.L; lat = grid_edges([args.L, args.L], True)
        else:
            raise SystemExit("hubbard: --lattice chain|square")
        N = 2 * Ns
        hop = [(i, j) for i, j in lat] + [(Ns + i, Ns + j) for i, j in lat]
        nbnd = len(hop)
        bmask = np.array([(1 << i) | (1 << j) for i, j in hop], np.int64)
        bbetween = np.array([((1 << max(i, j)) - (1 << (min(i, j) + 1))) if abs(i - j) > 1 else 0 for i, j in hop], np.int64)
        amp = -1.0 * np.ones(nbnd)
        k = args.nup + args.ndn
        info["geometry"] = f"nk.graph.Grid({args.lattice}, L={args.L}, pbc=True): {len(lat)} bonds on {Ns} sites; {N} spin-orbitals (up = bit i, down = bit {Ns}+i)"
        info["hamiltonian"] = (f"-t sum_<ij>,s (c+_is c_js + h.c.) + U sum_i n_i,up n_i,dn, t=1, U={args.U!r}, "
                               f"N_up={args.nup}, N_dn={args.ndn}; JW order all-up then all-down")
        info["sector_detail"] = f"N_up = {args.nup}, N_dn = {args.ndn} (fixed separately), no spatial symmetry"
        return N, k, True, (bmask, bbetween, amp, float(args.U)), info, dict(kernel="hub", hi_pop=args.ndn)
    else:
        raise SystemExit("unknown model")
    nbnd = len(edges)
    bmask = np.array([(1 << i) | (1 << j) for i, j in edges], np.int64)
    bbetween = np.zeros(nbnd, np.int64)
    c00 = np.zeros(nbnd); c11 = np.zeros(nbnd); cdiff = np.zeros(nbnd); amp = np.zeros(nbnd)
    for b, (i, j) in enumerate(edges):
        if fermion:
            lo, hi = min(i, j), max(i, j)
            bbetween[b] = ((1 << hi) - (1 << (lo + 1))) if hi - lo > 1 else 0
            c11[b] = V; amp[b] = -1.0
        else:
            c00[b] = 1.0; c11[b] = 1.0; cdiff[b] = -1.0; amp[b] = 2.0
    return N, k, fermion, (bmask, bbetween, c00, c11, cdiff, amp), info, dict(kernel="std", hi_pop=None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--L", type=int, default=0)
    ap.add_argument("--Nf", type=int, default=0)
    ap.add_argument("--V", type=float, default=0.0)
    ap.add_argument("--nup", type=int, default=0, help="spin models: number of up spins (default N/2); hubbard: N_up")
    ap.add_argument("--ndn", type=int, default=0, help="hubbard: N_dn")
    ap.add_argument("--U", type=float, default=0.0, help="hubbard: U")
    ap.add_argument("--lattice", default="", help="hubbard: chain | square")
    ap.add_argument("--bonds", default="", help="heis_bonds: JSON file {N, bonds}")
    ap.add_argument("--instance", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--tol", type=float, default=1e-9, help="stop when beta_m |s_m| < tol")
    ap.add_argument("--maxiter", type=int, default=2000)
    ap.add_argument("--check_every", type=int, default=5)
    ap.add_argument("--second_pass", type=int, default=1)
    ap.add_argument("--seed", type=int, default=20260915)
    args = ap.parse_args()
    t0 = time.time()
    progress = args.out.replace(".json", ".progress.jsonl")
    N, k, fermion, ham, info, extra = build_model(args)
    B = build_basis(N, k, extra["hi_pop"])
    D = B["D"]
    print(f"{args.instance}: N={N} k={k} D={D} threads={nb.get_num_threads()} {info['geometry']}", flush=True)
    bargs = (B["hiList"], B["startH"], B["rankL"], B["lowSorted"], B["lowStart"], k, B["nL"])
    if extra["kernel"] == "hub":
        mv = lambda vv, ww: matvec_hub(vv, ww, *bargs, *ham)
    else:
        mv = lambda vv, ww: matvec(vv, ww, *bargs, *ham)
    v = np.empty(D); vp = np.zeros(D); w = np.empty(D)
    random_fill(v, args.seed, 4096)
    nrm = math.sqrt(pdot(v, v)); div_into(v, v, nrm)
    a, b = [], []
    betaPrev = 0.0
    lam, s, resEst, m = float("nan"), None, float("nan"), 0
    tmv = 0.0
    pf = open(progress, "w")
    for it in range(args.maxiter):
        tm = time.time()
        mv(v, w)
        tmv += time.time() - tm
        alpha = pdot(w, v)
        lanczos_update(w, v, vp, alpha, betaPrev)
        beta = math.sqrt(pdot(w, w))
        a.append(alpha); m = it + 1
        last = beta < 1e-12 * max(1.0, abs(alpha)) or it == args.maxiter - 1
        rec = dict(it=m, alpha=alpha, beta=beta, t=round(time.time() - t0, 1), matvec_avg=round(tmv / m, 2))
        if m % args.check_every == 0 or last:
            b_ = b + [beta]
            lam, s = tridiag_lowest(a, b_)
            resEst = beta * abs(s[m - 1])
            rec.update(E_ritz=lam, resEst=resEst)
            print(f"  m={m} E={lam:.14f} resEst={resEst:.2e} t={time.time()-t0:.0f}s matvec={tmv/m:.2f}s", flush=True)
        pf.write(json.dumps(rec) + "\n"); pf.flush()
        if (m % args.check_every == 0 or last) and (resEst < args.tol or last):
            break
        b.append(beta)
        vp, v, w = v, w, vp  # rotate buffers: new v = w / beta
        div_into(v, v, beta)
        betaPrev = beta
    out = dict(instance=args.instance, D=D, N=N, particles_or_up_spins=k, E_ritz=lam, resEst=resEst, iterations=m,
               tol_resEst=args.tol, sector=info.get("sector_detail") or (("N_f = %d, no spatial symmetry" % k) if fermion else "S^z_tot = %g, no other symmetry" % (k - N / 2)),
               **{kk: vv for kk, vv in info.items() if kk not in ("bonds", "sector_detail")})
    if args.second_pass:
        x = np.zeros(D)
        random_fill(v, args.seed, 4096)
        nrm = math.sqrt(pdot(v, v)); div_into(v, v, nrm)
        vp.fill(0.0); betaPrev = 0.0
        for kk in range(m):
            axpy(x, float(s[kk]), v)
            if kk == m - 1:
                break
            mv(v, w)
            lanczos_update(w, v, vp, a[kk], betaPrev)
            vp, v, w = v, w, vp
            div_into(v, v, b[kk])
            betaPrev = b[kk]
        del vp, v
        hx = w
        mv(x, hx)
        xx = pdot(x, x); xhx = pdot(x, hx)
        E = xhx / xx
        out["E"] = E
        out["residual"] = math.sqrt(resid2(hx, x, E) / xx)
        del hx
        if args.model == "tv_chain":
            out["translation_expectation"] = translation_overlap(x, *bargs, N, fermion) / xx
            out["translation_note"] = ("<x|T|x>/<x|x>, T: site i -> i+1 with fermionic sign (-1)^(Nf-1) for the particle crossing "
                                       "the boundary (ascending JW order); 1 means total momentum 0, cos K for a real mixture of +-K")
        print(f"  E={E:.14f} residual={out['residual']:.2e}", flush=True)
    out.update(seconds=round(time.time() - t0, 1), matvec_seconds_avg=round(tmv / m, 3),
               peak_rss_GB=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6, 2),
               host=socket.gethostname(), numba_threads=nb.get_num_threads(), command=" ".join(sys.argv),
               code="out/VE-exact-recompute/code/ed_full2.py (E2 ed_full.py + hubbard/heis_bonds models)", lanczos="plain Lanczos, no reorthogonalisation, xorshift random start; "
               "convergence: beta_m |s_m| < tol checked every %d steps; E = Rayleigh quotient of the rebuilt Ritz vector" % args.check_every,
               alphas=a, betas=b)
    tmp = args.out + ".tmp"
    with open(tmp, "w") as f:
        json.dump(out, f, indent=1)
    os.replace(tmp, args.out)
    print("done", args.out, flush=True)


if __name__ == "__main__":
    main()
