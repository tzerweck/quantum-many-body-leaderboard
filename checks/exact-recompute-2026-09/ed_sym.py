#!/usr/bin/env python3
"""E2-exact-remote: symmetry-resolved Lanczos for spin-1/2 models on L x L tori (S^z_tot = 0).

Hamiltonian (Pauli, identical to E1 run_spins.mjs and VarBench programs/vmc_netket ham.py ColoredJ1J2):
  H = sum_{color-0 bonds} sigma_i.sigma_j + J2 sum_{color-1 bonds} sigma_i.sigma_j
  lattice "square":     ColoredJ1J2((L,L), pbc, back_diag=True)   (J2 = 0 gives the nk Grid square Heisenberg model)
  lattice "triangular": ColoredJ1J2((L,L), pbc, back_diag=False) with J2 = 1 (heis_tri)
Site (i, j) -> index i*L + j.

Symmetry group G = {g = T_(a,b) . Z^z . P_p}: P_p a point-group element (integer 2x2 matrix on (i,j) mod L, checked to be a
graph automorphism of each bond colour), Z spin inversion, T translations. One table over all C(N, N/2) S^z=0 states:
  tab[rank(s)] = orbit_index | (g_s << 40)   with   s = g_s(rep)
built by brute force (rep = minimum over G). rank(s) = startH[s >> nL] + rankL[s & maskL] (two half tables).
Sector = 1D character chi(g) = exp(-2 pi i (m a + n b)/L) chiP(p) zc^z, checked to be a homomorphism on all of G
(so k = 2 pi (m, n)/L must be invariant under the chosen point group). Basis |r~> = |O_r|^{-1/2} sum_{s in O_r} chi(g_s)^* |s>,
valid iff chi is trivial on Stab(r). Gather matvec:
  (H v)[r] = sum_{s = images of r} H_{r s} conj(chi(g_s)) sqrt(|Stab_rep(s)| / |Stab_r|) v[rep(s)]
"""
import argparse, itertools, json, math, os, resource, socket, sys, time
import numpy as np
import numba as nb
from numba import njit, prange

MASK40 = (1 << 40) - 1


# ------------------------------------------------------------------ lattice and group
def colored_j1j2(L1, L2, pbc, back_diag):
    k = lambda i, j: (i % L1) * L2 + (j % L2)
    p = 1 if pbc else 0
    edges = []
    for i in range(L1):
        for j in range(L2 - 1 + p): edges.append((k(i, j), k(i, j + 1), 0))
    for i in range(L1 - 1 + p):
        for j in range(L2): edges.append((k(i + 1, j), k(i, j), 0))
    for i in range(L1 - 1 + p):
        for j in range(L2 - 1 + p):
            edges.append((k(i, j), k(i + 1, j + 1), 1))
            if back_diag: edges.append((k(i + 1, j), k(i, j + 1), 1))
    return edges


def mat_mul(A, B, L):
    return tuple(tuple(sum(A[r][t] * B[t][c] for t in range(2)) % L for c in range(2)) for r in range(2))


def closure(gens, L):
    I = ((1, 0), (0, 1))
    els = [I]
    frontier = [I]
    while frontier:
        nxt = []
        for x in frontier:
            for g in gens:
                y = mat_mul(g, x, L)
                if y not in els:
                    els.append(y); nxt.append(y)
        frontier = nxt
    return els


POINT_GENS = {
    # square: C4 rotation (i,j)->(-j,i), axis mirror (i,j)->(i,-j), diagonal mirror (i,j)->(j,i)
    ("square", "c4v"): [((0, -1), (1, 0)), ((1, 0), (0, -1))],
    ("square", "c2v_axes"): [((-1, 0), (0, 1)), ((1, 0), (0, -1))],
    ("square", "c2v_diag"): [((0, 1), (1, 0)), ((-1, 0), (0, -1))],
    ("square", "trans"): [],
    # little groups of k on the 6x6 torus: (m,0) mirror_j; (m,m) mirror_d; (3,n) mirror_i
    ("square", "mirror_j"): [((1, 0), (0, -1))],
    ("square", "mirror_i"): [((-1, 0), (0, 1))],
    ("square", "mirror_d"): [((0, 1), (1, 0))],
    # triangular (neighbours (1,0),(0,1),(1,1)): C6 (i,j)->(i-j,i), mirror (i,j)->(j,i)
    ("triangular", "c6v"): [((1, -1), (1, 0)), ((0, 1), (1, 0))],
    ("triangular", "c3v"): [((0, -1), (1, -1)), ((0, 1), (1, 0))],  # C3 = C6^2: (i,j)->(-j, i-j)
    ("triangular", "c2v"): [((-1, 0), (0, -1)), ((0, 1), (1, 0))],
    ("triangular", "trans"): [],
}
NAMED = {
    "square": {"C4": ((0, -1), (1, 0)), "C2": ((-1, 0), (0, -1)), "sigma_axis(j->-j)": ((1, 0), (0, -1)), "sigma_axis(i->-i)": ((-1, 0), (0, 1)), "sigma_diag(i<->j)": ((0, 1), (1, 0))},
    "triangular": {"C6": ((1, -1), (1, 0)), "C3": ((0, -1), (1, -1)), "C2": ((-1, 0), (0, -1)), "sigma(i<->j)": ((0, 1), (1, 0)), "sigma'(i,j)->(-j,-i)": ((0, -1), (-1, 0))},
}


def setup_group(lattice, L, pgname, bonds_by_color, pbc=True):
    N = L * L
    LT = L if pbc else 1
    mats = closure([tuple(map(tuple, g)) for g in POINT_GENS[(lattice, pgname)]], L)
    site = lambda i, j: (i % L) * L + (j % L)
    pperms = []
    for M in mats:
        perm = np.empty(N, np.int64)
        for i in range(L):
            for j in range(L):
                if pbc:
                    perm[site(i, j)] = site(M[0][0] * i + M[0][1] * j, M[1][0] * i + M[1][1] * j)
                else:  # open: the same linear map about the cluster centre c = ((L-1)/2, (L-1)/2), x' = M x + (I - M) c
                    Ms = [[x if x <= 1 else x - L for x in row] for row in M]
                    t0 = (1 - Ms[0][0] - Ms[0][1]) * (L - 1); t1 = (1 - Ms[1][1] - Ms[1][0]) * (L - 1)
                    assert t0 % 2 == 0 and t1 % 2 == 0
                    i2 = Ms[0][0] * i + Ms[0][1] * j + t0 // 2; j2 = Ms[1][0] * i + Ms[1][1] * j + t1 // 2
                    assert 0 <= i2 < L and 0 <= j2 < L, "open-boundary point-group map leaves the cluster"
                    perm[site(i, j)] = site(i2, j2)
        assert len(set(perm.tolist())) == N, "point-group map is not a bijection"
        for color, bset in bonds_by_color.items():
            img = {tuple(sorted((int(perm[a]), int(perm[b])))) for a, b in bset}
            if img != bset:
                raise SystemExit(f"point group element {M} is not an automorphism of colour {color}")
        pperms.append(perm)
    nP = len(mats)
    # translations
    tperm = {}
    for a in range(LT):
        for b in range(LT):
            tperm[(a, b)] = np.array([site(i + a, j + b) for i in range(L) for j in range(L)], np.int64)
    nG = 2 * nP * LT * LT
    perms = np.empty((nG, N), np.int64)
    zs = np.empty(nG, np.int64)
    dec = []
    for z in range(2):
        for p in range(nP):
            for a in range(LT):
                for b in range(LT):
                    g = ((z * nP + p) * LT + a) * LT + b
                    perms[g] = tperm[(a, b)][pperms[p]]  # site i -> P(i) -> P(i) + (a,b)
                    zs[g] = z
                    dec.append((z, p, a, b))
    key = {(perms[g].tobytes(), int(zs[g])): g for g in range(nG)}
    assert len(key) == nG, "group elements not distinct"
    comp = np.empty((nG, nG), np.int64)
    for g1 in range(nG):
        pc = perms[g1][perms]  # (g1 g2)(i) = g1(g2(i))
        for g2 in range(nG):
            comp[g1, g2] = key[(pc[g2].tobytes(), int(zs[g1] ^ zs[g2]))]
    inv = np.array([int(np.where(comp[g] == 0)[0][0]) for g in range(nG)], np.int64)
    assert all(comp[g, inv[g]] == 0 for g in range(nG))
    # byte tables for P
    nbytes = (N + 7) // 8
    ptab = np.zeros((nP, nbytes, 256), np.int64)
    for p in range(nP):
        for byte in range(nbytes):
            for val in range(256):
                x = 0
                for bit in range(8):
                    i = 8 * byte + bit
                    if i < N and (val >> bit) & 1:
                        x |= 1 << int(pperms[p][i])
                ptab[p, byte, val] = x
    # point-group composition and 1D real irreps (brute force over sign assignments)
    pkey = {m: n for n, m in enumerate(mats)}
    pcomp = np.array([[pkey[mat_mul(mats[x], mats[y], L)] for y in range(nP)] for x in range(nP)])
    irreps = []
    for signs in itertools.product([1, -1], repeat=nP):
        if signs[0] != 1: continue
        ok = all(signs[x] * signs[y] == signs[pcomp[x, y]] for x in range(nP) for y in range(nP))
        if ok: irreps.append(np.array(signs, np.float64))
    red = lambda M: tuple(tuple(x % L for x in row) for row in M)
    named = {nm: pkey[red(M)] for nm, M in NAMED[lattice].items() if red(M) in pkey}
    return dict(LT=LT, nP=nP, mats=mats, nG=nG, perms=perms, zs=zs, comp=comp, inv=inv, ptab=ptab, nbytes=nbytes, irreps=irreps, named=named, dec=dec)


def irrep_label(lattice, pgname, chiP, named):
    ch = {nm: int(chiP[idx]) for nm, idx in named.items()}
    lab = None
    if lattice == "square" and pgname == "c4v":
        c4, sa = ch["C4"], ch["sigma_axis(j->-j)"]
        lab = {(1, 1): "A1", (1, -1): "A2", (-1, 1): "B1", (-1, -1): "B2"}[(c4, sa)]
    elif lattice == "triangular" and pgname == "c6v":
        c6, s = ch["C6"], ch["sigma(i<->j)"]
        lab = {(1, 1): "A1", (1, -1): "A2", (-1, 1): "B(sigma(i<->j)=+1)", (-1, -1): "B(sigma(i<->j)=-1)"}[(c6, s)]
    elif lattice == "triangular" and pgname == "c3v":
        lab = {1: "A1", -1: "A2"}[ch["sigma(i<->j)"]]
    return lab, ch


# ------------------------------------------------------------------ basis (same construction as ed_full.py)
def popcount_np(x):
    x = x.astype(np.int64); c = np.zeros_like(x)
    while np.any(x):
        c += x & 1; x >>= 1
    return c


def build_basis(N, k, shuffle_seed=12345):
    nL = N // 2; nH = N - nL
    wL = np.arange(1 << nL, dtype=np.int64); pL = popcount_np(wL)
    orderL = np.lexsort((wL, pL)); lowSorted = wL[orderL]
    lowStart = np.zeros(nL + 2, np.int64)
    for p in range(nL + 1): lowStart[p + 1] = lowStart[p] + math.comb(nL, p)
    rankL = np.empty(1 << nL, np.int64)
    rankL[orderL] = np.arange(1 << nL, dtype=np.int64) - lowStart[pL[orderL]]
    wH = np.arange(1 << nH, dtype=np.int64); pH = popcount_np(wH)
    startH = np.full(1 << nH, -1, np.int64)
    hiList = []; off = 0
    for p in range(max(0, k - nL), min(nH, k) + 1):
        hs = wH[pH == p]; blk = math.comb(nL, k - p)
        startH[hs] = off + np.arange(len(hs), dtype=np.int64) * blk
        hiList.append(hs); off += len(hs) * blk
    assert off == math.comb(N, k)
    hiList = np.concatenate(hiList).astype(np.int64)
    hiList = hiList[np.random.default_rng(shuffle_seed).permutation(len(hiList))]  # balance static chunking
    return dict(N=N, k=k, nL=nL, D=off, lowSorted=lowSorted, lowStart=lowStart, rankL=rankL, startH=startH, hiList=hiList)


# ------------------------------------------------------------------ numba kernels
@njit(inline="always")
def popcnt64(x):
    x = x - ((x >> 1) & 0x5555555555555555)
    x = (x & 0x3333333333333333) + ((x >> 2) & 0x3333333333333333)
    x = (x + (x >> 4)) & 0x0F0F0F0F0F0F0F0F
    return (x * 0x0101010101010101) >> 56


@njit(inline="always")
def apply_p(ptab, p, s, nbytes):
    x = np.int64(0)
    for byte in range(nbytes):
        x |= ptab[p, byte, (s >> (8 * byte)) & 255]
    return x


@njit(inline="always")
def shift_row(s, L, N, full):  # (i,j) -> (i+1, j)
    return ((s << L) | (s >> (N - L))) & full


@njit(inline="always")
def shift_col(s, L, notFirst, first):  # (i,j) -> (i, j+1)
    return ((s << 1) & notFirst) | ((s >> (L - 1)) & first)


@njit(inline="always")
def apply_g(g, s, ptab, nbytes, nP, L, LT, N, full, notFirst, first):
    b = g % LT; g //= LT
    a = g % LT; g //= LT
    p = g % nP; z = g // nP
    x = apply_p(ptab, p, s, nbytes)
    if z == 1:
        x ^= full
    for _ in range(a): x = shift_row(x, L, N, full)
    for _ in range(b): x = shift_col(x, L, notFirst, first)
    return x


@njit(parallel=True, cache=True)
def build_pass1(tab, counts, hiList, startH, lowSorted, lowStart, k, nL, ptab, nbytes, nP, L, LT, N, full, notFirst, first):
    for t in prange(hiList.shape[0]):
        hi = hiList[t]
        q = k - popcnt64(hi)
        base = startH[hi]; l0 = lowStart[q]; n = lowStart[q + 1] - l0
        cnt = 0
        for jj in range(n):
            s = (hi << nL) | lowSorted[l0 + jj]
            best = s; bestg = 0
            for p in range(nP):
                x0 = apply_p(ptab, p, s, nbytes)
                for z in range(2):
                    y = x0 ^ full if z == 1 else x0
                    for a in range(LT):
                        yb = y
                        for b in range(LT):
                            if yb < best:
                                best = yb; bestg = ((z * nP + p) * LT + a) * LT + b
                            yb = shift_col(yb, L, notFirst, first)
                        y = shift_row(y, L, N, full)
            if best == s:
                cnt += 1
                tab[base + jj] = np.int64(1) << 62
            else:
                tab[base + jj] = bestg
        counts[t] = cnt


@njit(parallel=True, cache=True)
def build_pass2(tab, reps, offsets, hiList, startH, lowSorted, lowStart, k, nL):
    flag = np.int64(1) << 62
    for t in prange(hiList.shape[0]):
        hi = hiList[t]
        q = k - popcnt64(hi)
        base = startH[hi]; l0 = lowStart[q]; n = lowStart[q + 1] - l0
        ri = offsets[t]
        for jj in range(n):
            if tab[base + jj] == flag:
                tab[base + jj] = ri  # element 0 = identity
                reps[ri] = (hi << nL) | lowSorted[l0 + jj]
                ri += 1


@njit(parallel=True, cache=True)
def build_pass3(tab, hiList, startH, rankL, lowSorted, lowStart, k, nL, ptab, nbytes, nP, L, LT, N, full, notFirst, first, inv):
    maskL = (np.int64(1) << nL) - 1
    for t in prange(hiList.shape[0]):
        hi = hiList[t]
        q = k - popcnt64(hi)
        base = startH[hi]; l0 = lowStart[q]; n = lowStart[q + 1] - l0
        for jj in range(n):
            e = tab[base + jj]
            if e < 0:  # marks "rep written in pass 2": stored as -(index+1)
                continue
            s = (hi << nL) | lowSorted[l0 + jj]
            rep = apply_g(e, s, ptab, nbytes, nP, L, LT, N, full, notFirst, first)
            r = startH[rep >> nL] + rankL[rep & maskL]
            ridx = -tab[r] - 1
            tab[base + jj] = ridx | (inv[e] << 40)


@njit(parallel=True, cache=True)
def finalize_reps(tab, reps, startH, rankL, nL):
    maskL = (np.int64(1) << nL) - 1
    for i in prange(reps.shape[0]):
        s = reps[i]
        r = startH[s >> nL] + rankL[s & maskL]
        tab[r] = i  # identity element


@njit(parallel=True, cache=True)
def stabilizers(reps, chi, ptab, nbytes, nP, L, LT, N, full, notFirst, first, stab, chisum_re, chisum_im):
    for i in prange(reps.shape[0]):
        s = reps[i]
        c = 0; sr = 0.0; si = 0.0
        for p in range(nP):
            x0 = apply_p(ptab, p, s, nbytes)
            for z in range(2):
                y = x0 ^ full if z == 1 else x0
                for a in range(LT):
                    yb = y
                    for b in range(LT):
                        if yb == s:
                            g = ((z * nP + p) * LT + a) * LT + b
                            c += 1; sr += chi[g].real; si += chi[g].imag
                        yb = shift_col(yb, L, notFirst, first)
                    y = shift_row(y, L, N, full)
        stab[i] = c; chisum_re[i] = sr; chisum_im[i] = si


@njit(parallel=True, cache=True)
def matvec(v, out, reps, valid, sq, tab, chic, startH, rankL, nL, bmask, cdiag, amp):
    maskL = (np.int64(1) << nL) - 1
    nb_ = bmask.shape[0]
    for i in prange(reps.shape[0]):
        if not valid[i]:
            out[i] = 0.0
            continue
        r = reps[i]
        d = 0.0
        acc = v[i] * 0.0
        inv_sqi = 1.0 / sq[i]
        for b in range(nb_):
            m = bmask[b]
            x = r & m
            if x == 0 or x == m:
                d += cdiag[b]
            else:
                d -= cdiag[b]
                s = r ^ m
                e = tab[startH[s >> nL] + rankL[s & maskL]]
                j = e & 0xFFFFFFFFFF
                g = e >> 40
                acc += (amp[b] * sq[j] * inv_sqi) * chic[g] * v[j]
        out[i] = acc + d * v[i]


@njit(parallel=True, cache=True)
def pdot_re(a, b):
    s = 0.0
    for i in prange(a.shape[0]):
        s += (np.conj(a[i]) * b[i]).real
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
        s += (np.conj(r) * r).real
    return s


@njit(parallel=True, cache=True)
def random_fill_c(v, valid, seed, nblocks):
    D = v.shape[0]
    bs = (D + nblocks - 1) // nblocks
    for blk in prange(nblocks):
        x = np.uint64(seed) * np.uint64(0x9E3779B97F4A7C15) + np.uint64(blk + 1) * np.uint64(0xBF58476D1CE4E5B9)
        for i in range(blk * bs, min(D, (blk + 1) * bs)):
            x ^= x << np.uint64(13); x ^= x >> np.uint64(7); x ^= x << np.uint64(17)
            re = (x >> np.uint64(11)) * (1.0 / 9007199254740992.0) - 0.5
            x ^= x << np.uint64(13); x ^= x >> np.uint64(7); x ^= x << np.uint64(17)
            im = (x >> np.uint64(11)) * (1.0 / 9007199254740992.0) - 0.5
            if valid[i]:
                v[i] = re + 1j * im
            else:
                v[i] = 0.0


@njit(parallel=True, cache=True)
def random_fill_r(v, valid, seed, nblocks):
    D = v.shape[0]
    bs = (D + nblocks - 1) // nblocks
    for blk in prange(nblocks):
        x = np.uint64(seed) * np.uint64(0x9E3779B97F4A7C15) + np.uint64(blk + 1) * np.uint64(0xBF58476D1CE4E5B9)
        for i in range(blk * bs, min(D, (blk + 1) * bs)):
            x ^= x << np.uint64(13); x ^= x >> np.uint64(7); x ^= x << np.uint64(17)
            re = (x >> np.uint64(11)) * (1.0 / 9007199254740992.0) - 0.5
            if valid[i]:
                v[i] = re
            else:
                v[i] = 0.0


def random_fill(v, valid, seed, nblocks, is_complex):
    if is_complex:
        random_fill_c(v, valid, seed, nblocks)
    else:
        random_fill_r(v, valid, seed, nblocks)


def tridiag_lowest(a, b):
    from scipy.linalg import eigh_tridiagonal
    w, s = eigh_tridiagonal(np.array(a), np.array(b[: len(a) - 1]), select="i", select_range=(0, 0))
    return float(w[0]), s[:, 0]


def lanczos(mv, D, valid, dtype, tol, maxiter, check_every, seed, second_pass, progress_path, t0):
    is_c = np.dtype(dtype) == np.complex128
    v = np.empty(D, dtype); vp = np.zeros(D, dtype); w = np.empty(D, dtype)
    random_fill(v, valid, seed, 1024, is_c)
    nrm = math.sqrt(pdot_re(v, v)); div_into(v, v, nrm)
    a, b = [], []
    betaPrev = 0.0; lam = float("nan"); s = None; resEst = float("nan"); m = 0; tmv = 0.0
    pf = open(progress_path, "w")
    for it in range(maxiter):
        tm = time.time(); mv(v, w); tmv += time.time() - tm
        alpha = pdot_re(v, w)
        lanczos_update(w, v, vp, alpha, betaPrev)
        beta = math.sqrt(pdot_re(w, w))
        a.append(alpha); m = it + 1
        last = beta < 1e-12 * max(1.0, abs(alpha)) or it == maxiter - 1
        rec = dict(it=m, alpha=alpha, beta=beta, t=round(time.time() - t0, 1))
        chk = (m % check_every == 0) or last
        if chk:
            lam, s = tridiag_lowest(a, b + [beta])
            resEst = beta * abs(s[m - 1])
            rec.update(E_ritz=lam, resEst=resEst)
        pf.write(json.dumps(rec) + "\n"); pf.flush()
        if chk and (resEst < tol or last):
            break
        b.append(beta)
        vp, v, w = v, w, vp
        div_into(v, v, beta)
        betaPrev = beta
    pf.close()
    res = dict(E_ritz=lam, resEst=resEst, iterations=m, matvec_seconds_avg=round(tmv / m, 4), alphas=a, betas=b)
    if second_pass:
        x = np.zeros(D, dtype)
        random_fill(v, valid, seed, 1024, is_c)
        nrm = math.sqrt(pdot_re(v, v)); div_into(v, v, nrm)
        vp.fill(0.0); betaPrev = 0.0
        for kk in range(m):
            axpy(x, float(s[kk]), v)
            if kk == m - 1: break
            mv(v, w)
            lanczos_update(w, v, vp, a[kk], betaPrev)
            vp, v, w = v, w, vp
            div_into(v, v, b[kk]); betaPrev = b[kk]
        hx = w; mv(x, hx)
        xx = pdot_re(x, x); E = pdot_re(x, hx) / xx
        res["E"] = E; res["residual"] = math.sqrt(resid2(hx, x, E) / xx)
    return res


# ------------------------------------------------------------------ driver
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lattice", required=True, choices=["square", "triangular"])
    ap.add_argument("--L", type=int, required=True)
    ap.add_argument("--pbc", type=int, default=1)
    ap.add_argument("--group", required=True, help="point group used in the table: c4v, c2v_axes, c2v_diag, trans (square); c6v, c3v, c2v, trans (triangular)")
    ap.add_argument("--J2", default="0", help="comma list; square: J2 on both diagonals; triangular: must be 1 (heis_tri)")
    ap.add_argument("--k", default="0,0", help="semicolon list of m,n (k = 2 pi (m,n)/L), or 'all'")
    ap.add_argument("--irreps", default="all", help="comma list of irrep indices (order printed in the log) or all")
    ap.add_argument("--z", default="1,-1")
    ap.add_argument("--name", required=True, help="result prefix, e.g. J1J2__square_36_P")
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--tol", type=float, default=1e-9)
    ap.add_argument("--maxiter", type=int, default=1500)
    ap.add_argument("--check_every", type=int, default=5)
    ap.add_argument("--second_pass", type=int, default=1)
    ap.add_argument("--seed", type=int, default=20260915)
    ap.add_argument("--tasks", default="", help="ordered task list 'J2/m,n/irrep/z;...' (overrides --J2 --k --irreps --z)")
    ap.add_argument("--skip_invalid_k", type=int, default=1, help="with --k all: skip momenta not invariant under the point group")
    args = ap.parse_args()
    t0 = time.time()
    os.makedirs(args.outdir, exist_ok=True)
    L = args.L; N = L * L
    edges = colored_j1j2(L, L, bool(args.pbc), args.lattice == "square")
    bonds_by_color = {c: {tuple(sorted(e[:2])) for e in edges if e[2] == c} for c in (0, 1)}
    for c in (0, 1):
        if len(bonds_by_color[c]) != sum(1 for e in edges if e[2] == c):
            raise SystemExit(f"duplicate bonds in colour {c}")
    if args.lattice == "triangular":  # heis_tri: J = [1, 1], both colours are one bond class for the automorphism check
        bonds_by_color = {0: bonds_by_color[0] | bonds_by_color[1]}
    if len({tuple(sorted(e[:2])) for e in edges}) != len(edges):
        raise SystemExit("duplicate bonds across colours")
    G = setup_group(args.lattice, L, args.group, bonds_by_color, bool(args.pbc))
    LT = G["LT"]
    nP, nG = G["nP"], G["nG"]
    full = (1 << N) - 1
    first = sum(1 << (i * L) for i in range(L)); notFirst = full ^ first
    gargs = (G["ptab"], G["nbytes"], nP, L, LT, N, full, notFirst, first)
    print(f"lattice={args.lattice} L={L} group={args.group} |P|={nP} |G|={nG} irreps(1D, real)={len(G['irreps'])} threads={nb.get_num_threads()}", flush=True)
    for n_, chiP in enumerate(G["irreps"]):
        print(f"  irrep {n_}: {irrep_label(args.lattice, args.group, chiP, G['named'])}", flush=True)
    # verify the numba action against the explicit permutations
    rng = np.random.default_rng(1)
    for _ in range(3):
        bits = rng.permutation(N)[: N // 2]
        s = int(sum(1 << int(x) for x in bits))
        for g in range(nG):
            want = 0
            for i in range(N):
                if (s >> i) & 1: want |= 1 << int(G["perms"][g][i])
            if G["zs"][g]: want ^= full
            got = apply_g(g, s, *gargs)
            if got != want: raise SystemExit(f"apply_g mismatch g={g}")
    # basis + table
    B = build_basis(N, N // 2)
    D = B["D"]
    print(f"S^z=0 dimension {D}; allocating table {D * 8 / 1e9:.1f} GB", flush=True)
    tb = time.time()
    tab = np.empty(D, np.int64)
    counts = np.zeros(len(B["hiList"]), np.int64)
    build_pass1(tab, counts, B["hiList"], B["startH"], B["lowSorted"], B["lowStart"], N // 2, B["nL"], *gargs)
    nrep = int(counts.sum())
    offsets = np.concatenate([[0], np.cumsum(counts)[:-1]]).astype(np.int64)
    reps = np.empty(nrep, np.int64)
    t1 = time.time()
    build_pass2(tab, reps, offsets, B["hiList"], B["startH"], B["lowSorted"], B["lowStart"], N // 2, B["nL"])
    # mark rep entries as negative -(index+1) so pass 3 can distinguish them
    mark_reps_negative(tab, reps, B["startH"], B["rankL"], B["nL"])
    build_pass3(tab, B["hiList"], B["startH"], B["rankL"], B["lowSorted"], B["lowStart"], N // 2, B["nL"], *gargs, G["inv"])
    finalize_reps(tab, reps, B["startH"], B["rankL"], B["nL"])
    tbuild = time.time() - tb
    print(f"table built: {nrep} orbits (D/|G| = {D / nG:.0f}) in {tbuild:.0f}s (pass1 {t1 - tb:.0f}s)", flush=True)
    # momenta
    if args.k == "all":
        klist = [(m, n) for m in range(L) for n in range(L)]
    else:
        klist = [tuple(int(x) for x in kk.split(",")) for kk in args.k.split(";")]
    J2s = [float(x) for x in args.J2.split(",")]
    irr_idx = list(range(len(G["irreps"]))) if args.irreps == "all" else [int(x) for x in args.irreps.split(",")]
    zlist = [int(x) for x in args.z.split(",")]
    comp = G["comp"]
    dec = np.array(G["dec"])
    summary_path = os.path.join(args.outdir, f"{args.name}__{args.group}__summary.jsonl")
    if args.tasks:
        tasks = []
        for t in args.tasks.split(";"):
            j2s, ks, irs, zs_ = t.split("/")
            if irs.lstrip("-").isdigit():
                ii_ = int(irs)
            elif "=" in irs:  # character constraints, e.g. C2=-1&sigma_axis(j->-j)=1
                cons = {c.rsplit("=", 1)[0]: int(c.rsplit("=", 1)[1]) for c in irs.split("&")}
                cand = [n_ for n_, chiP in enumerate(G["irreps"]) if all(irrep_label(args.lattice, args.group, chiP, G["named"])[1].get(k_) == v_ for k_, v_ in cons.items())]
                if len(cand) != 1: raise SystemExit(f"character constraints {irs} select {len(cand)} irreps for group {args.group}")
                ii_ = cand[0]
            else:
                cand = [n_ for n_, chiP in enumerate(G["irreps"]) if irrep_label(args.lattice, args.group, chiP, G["named"])[0] == irs]
                if len(cand) != 1: raise SystemExit(f"irrep label {irs} not found for group {args.group}")
                ii_ = cand[0]
            tasks.append((float(j2s), tuple(int(x) for x in ks.split(",")), ii_, int(zs_)))
    else:
        tasks = [(J2, kk, ii, zc) for J2 in J2s for kk in klist for ii in irr_idx for zc in zlist]
    for (J2, (m_, n_), ii, zc) in tasks:
        if args.lattice == "triangular" and J2 != 1.0:
            raise SystemExit("triangular Heisenberg needs J2=1")
        use = [e for e in edges if e[2] == 0 or J2 != 0.0]
        bmask = np.array([(1 << e[0]) | (1 << e[1]) for e in use], np.int64)
        J = np.array([1.0 if e[2] == 0 else J2 for e in use])
        cdiag = J.copy(); amp = 2.0 * J
        if True:
            if True:
                chiP = G["irreps"][ii]
                if True:
                    phase = np.exp(-2j * np.pi * (m_ * dec[:, 2] + n_ * dec[:, 3]) / L)
                    chi = phase * chiP[dec[:, 1]] * np.where(dec[:, 0] == 1, zc, 1)
                    # homomorphism check on all pairs
                    err = np.max(np.abs(chi[:, None] * chi[None, :] - chi[comp]))
                    if err > 1e-9:
                        if args.k == "all" and args.skip_invalid_k:
                            continue
                        raise SystemExit(f"k=({m_},{n_}) not compatible with group {args.group}: homomorphism error {err}")
                    lab, ch = irrep_label(args.lattice, args.group, chiP, G["named"])
                    jtag = ("%g" % J2)
                    fname = f"{args.name}__J2_{jtag}__k{m_}-{n_}__{args.group}-irrep{ii}__z{'+' if zc > 0 else '-'}"
                    outp = os.path.join(args.outdir, fname + ".json")
                    if os.path.exists(outp):
                        print(f"skip {fname} (exists)", flush=True); continue
                    is_real = np.max(np.abs(chi.imag)) < 1e-12
                    dtype = np.float64 if is_real else np.complex128
                    stab = np.empty(nrep, np.int64); cre = np.empty(nrep); cim = np.empty(nrep)
                    stabilizers(reps, chi.astype(np.complex128), *gargs, stab, cre, cim)
                    valid = (np.abs(cre - stab) < 1e-9) & (np.abs(cim) < 1e-9)
                    dim = int(valid.sum())
                    sq = np.sqrt(stab.astype(np.float64))
                    chic = np.conj(chi).real.copy() if is_real else np.conj(chi).astype(np.complex128)
                    ts = time.time()
                    info = dict(instance_name=args.name, lattice=args.lattice, L=L, J2=J2, k=[m_, n_], k_value=f"2pi({m_},{n_})/{L}",
                                point_group=args.group, point_group_elements=[list(map(list, M)) for M in G["mats"]], irrep_index=ii,
                                irrep_label=lab, irrep_characters=ch, spin_inversion=zc, sector_dimension=dim, Sz0_dimension=D,
                                n_orbits=nrep, bonds=len(use), dtype=str(np.dtype(dtype)))
                    print(f"== J2={J2} k=({m_},{n_}) irrep {ii} {lab} {ch} z={zc}: dim={dim} dtype={np.dtype(dtype)}", flush=True)
                    if dim == 0:
                        rec = dict(info, E=None, note="empty sector")
                    else:
                        mv = lambda v, w: matvec(v, w, reps, valid, sq, tab, chic, B["startH"], B["rankL"], B["nL"], bmask, cdiag, amp)
                        res = lanczos(mv, nrep, valid, dtype, args.tol, args.maxiter, args.check_every, args.seed, args.second_pass,
                                      os.path.join(args.outdir, fname + ".progress.jsonl"), time.time())
                        rec = dict(info, **res)
                    rec.update(seconds_sector=round(time.time() - ts, 1), seconds_table_build=round(tbuild, 1),
                               peak_rss_GB=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6, 2), host=socket.gethostname(),
                               numba_threads=nb.get_num_threads(), command=" ".join(sys.argv), tol_resEst=args.tol,
                               code="out/E2-exact-remote/code/ed_sym.py",
                               hamiltonian="Pauli: H = sum_colour0 sigma.sigma + J2 sum_colour1 sigma.sigma, ColoredJ1J2((L,L), pbc=%s, back_diag=%s)" % (bool(args.pbc), args.lattice == "square"), pbc=bool(args.pbc))
                    print(f"   E={rec.get('E')} ritz={rec.get('E_ritz')} res={rec.get('residual')} it={rec.get('iterations')} t={rec['seconds_sector']}s", flush=True)
                    with open(outp + ".tmp", "w") as f: json.dump(rec, f, indent=1)
                    os.replace(outp + ".tmp", outp)
                    with open(summary_path, "a") as f:
                        f.write(json.dumps({kk: rec.get(kk) for kk in ["J2", "k", "irrep_label", "irrep_characters", "spin_inversion", "sector_dimension", "E", "E_ritz", "residual", "iterations", "seconds_sector"]}) + "\n")
    print("ALL_DONE", flush=True)


@njit(parallel=True, cache=True)
def mark_reps_negative(tab, reps, startH, rankL, nL):
    maskL = (np.int64(1) << nL) - 1
    for i in prange(reps.shape[0]):
        s = reps[i]
        tab[startH[s >> nL] + rankL[s & maskL]] = -(i + 1)


if __name__ == "__main__":
    main()
