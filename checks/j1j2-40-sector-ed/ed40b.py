#!/usr/bin/env python3
"""E1 (qmbl-verify 2026-09-29 handoff) ed40b.py = ed40.py with the sweep restructured for speed (same arithmetic):
per row, all target keys first (contiguous 1D min over the group, vectorisable), then all hash slots, a touch pass that
issues every record load before the probes (memory-level parallelism), then the probes and sums. ed40.py: symmetric-sector Lanczos for the spin-1/2 J1-J2 model on tilted square
clusters with a hashed representative basis, several (sector, J2) vectors in lockstep.

Hamiltonian (Pauli, QMBL's stored convention): H = sum_{NN} sigma_i.sigma_j + J2 sum_{NNN} sigma_i.sigma_j, each bond once,
NN directions (1,0), (0,1), NNN directions (1,1), (1,-1).
Cluster: square lattice modulo Lambda = span(L1, L2), N = |det|. Sites are labelled through the translation group
Z^2/Lambda = Z_a x Z_b: site (e, n) sits at e*g2 + n*g1 and is bit e*b + n, so a translation is a cyclic permutation of the
b-bit blocks plus the same rotation inside every block. Point group: C4 (or its C2 subgroup) about site 0, by byte tables.
Group G = T x| P x Z2 (spin flip). Sectors: momentum 0, spin flip even, point-group character trivial ('A') or the sign
character ('B': C4 rotation -> -1 for --group c4; C2 rotation -> -1 for --group c2).
Basis: representative = minimum bit integer of the orbit, found by brute force over the S^z = 0 space with early exit.
Every orbit is A-valid; an orbit is B-valid iff no stabiliser element carries character -1. The representatives are kept
compact (reps[i]) and found through an open-addressing hash table (linear probing, Fibonacci hash) whose 64-byte records
hold the key and the current input vectors (up to 7), so an off-diagonal element costs one cache line.
Off-diagonal targets: for all g at once g(r ^ m_b) = g(r) ^ g(m_b); the minimum over g and the spin flip is taken on
(image << 1 | B-character bit), so the minimum also yields the character of the element that maps the target to its
representative (unique on B-valid orbits; B-invalid orbits carry zero amplitude).
Matrix element (real 1D characters, P = |G|^-1 sum chi(g) U_g):
    (Hv)_i = diag_i v_i + sum_{b antiparallel in r_i} 2 J_b chi(h) sqrt(|Stab_j| / |Stab_i|) v_j,  h(r_i ^ m_b) = r_j.
Lanczos without reorthogonalisation, lowest Ritz value checked every --check_every steps (resEst = beta_m |s_m|), second
pass rebuilds the Ritz vector; reported: E (Rayleigh quotient), true residual ||Hx - Ex||/||x||, J1-bond energy <H_J1>.
"""
import argparse, hashlib, json, math, os, resource, socket, sys, time
import numpy as np
import numba as nb
from numba import njit, prange

HC = np.uint64(0x9E3779B97F4A7C15)
BIG = np.int64(1) << np.int64(62)


# ------------------------------------------------------------------ cluster and group (plain Python, checked)
def setup_cluster(L1, L2, group):
    M = np.array([L1, L2], dtype=np.int64)
    D = int(M[0, 0] * M[1, 1] - M[0, 1] * M[1, 0]); N = abs(D)
    assert 8 <= N <= 62
    adj = np.array([[M[1, 1], -M[0, 1]], [-M[1, 0], M[0, 0]]], dtype=np.int64)  # D * inv(M); x = c @ M

    def key(x):
        f = (np.asarray(x, dtype=np.int64) @ adj) % N
        return (int(f[0]), int(f[1]))

    k0 = key((0, 0))
    assert key(L1) == k0 and key(L2) == k0
    seen = {k0: (0, 0)}; frontier = [(0, 0)]
    while frontier and len(seen) < N:
        nxt = []
        for (x, y) in frontier:
            for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                p = (x + d[0], y + d[1]); kk = key(p)
                if kk not in seen:
                    seen[kk] = p; nxt.append(p)
        frontier = nxt
    assert len(seen) == N
    cosets = list(seen.values())

    def order(v):
        for n in range(1, N + 1):
            if key((n * v[0], n * v[1])) == k0:
                return n
        raise RuntimeError("order")

    orders = {p: order(p) for p in cosets}
    b = max(orders.values()); a = N // b
    assert a * b == N
    g1 = (1, 0) if orders.get((1, 0)) == b else next(p for p in cosets if orders[p] == b)
    g2 = (0, 0)
    if a > 1:
        cand = sorted((p for p in cosets if orders[p] == a), key=lambda p: (abs(p[0]) + abs(p[1]), p))
        for u in cand:
            S = {key((e * u[0] + n * g1[0], e * u[1] + n * g1[1])) for e in range(a) for n in range(b)}
            if len(S) == N:
                g2 = u; break
        else:
            raise RuntimeError("no complementary translation generator")
    pos = np.zeros((N, 2), np.int64); idx = {}
    for e in range(a):
        for n in range(b):
            p = (e * g2[0] + n * g1[0], e * g2[1] + n * g1[1])
            pos[e * b + n] = p; idx[key(p)] = e * b + n
    assert len(idx) == N

    def site(x):
        return idx[key(x)]

    g1a = np.array(g1, np.int64); g2a = np.array(g2, np.int64)
    for p in range(a):
        for q in range(b):
            for i in range(N):
                e, n = divmod(i, b)
                assert site(pos[i] + p * g2a + q * g1a) == ((e + p) % a) * b + (n + q) % b
    R90 = np.array([[0, -1], [1, 0]], np.int64)
    Rm = [np.linalg.matrix_power(R90, m) for m in range(4)]
    assert key(R90 @ np.array(L1, np.int64)) == k0 and key(R90 @ np.array(L2, np.int64)) == k0, "cluster not C4 symmetric"
    if group == "c4":
        rots = [0, 1, 2, 3]; cbitR = [m & 1 for m in rots]
    elif group == "c2":
        rots = [0, 2]; cbitR = [(m // 2) & 1 for m in rots]
    else:
        raise SystemExit("group must be c4 or c2")
    prot = [np.array([site(Rm[m] @ pos[i]) for i in range(N)], np.int64) for m in rots]
    perms = []
    for mi in range(len(rots)):
        for p in range(a):
            for q in range(b):
                pt = np.array([((i // b + p) % a) * b + (i % b + q) % b for i in range(N)], np.int64)
                perms.append(pt[prot[mi]])  # first rotate, then translate
    perms = np.array(perms, np.int64)
    S = {pp.tobytes() for pp in perms}
    assert len(S) == len(perms) == len(rots) * N, "group elements not distinct"
    for x in perms:
        for y in perms:
            assert x[y].tobytes() in S, "group not closed"
    bonds = []
    for i in range(N):
        for d, t in (((1, 0), 0), ((0, 1), 0), ((1, 1), 1), ((1, -1), 1)):
            j = site(pos[i] + np.array(d, np.int64))
            assert j != i
            bonds.append((i, j, t))
    assert len({frozenset((i, j)) for i, j, t in bonds}) == len(bonds) == 4 * N, "duplicate bonds"
    bset = {(min(i, j), max(i, j), t) for i, j, t in bonds}
    for pp in perms:
        assert {(min(int(pp[i]), int(pp[j])), max(int(pp[i]), int(pp[j])), t) for i, j, t in bset} == bset, "bonds not invariant"
    nbytes = (N + 7) // 8
    rtab = np.zeros((len(rots), nbytes, 256), np.int64)
    for mi in range(len(rots)):
        for byte in range(nbytes):
            for val in range(256):
                x = 0
                for bit in range(8):
                    i = 8 * byte + bit
                    if i < N and (val >> bit) & 1:
                        x |= 1 << int(prot[mi][i])
                rtab[mi, byte, val] = x
    bmask = np.array([(1 << i) | (1 << j) for i, j, t in bonds], np.int64)
    btype = np.array([t for i, j, t in bonds], np.int64)
    MK = np.array([[((1 << int(pp[i])) | (1 << int(pp[j]))) << 1 for pp in perms] for i, j, t in bonds], np.int64)
    cbitG = np.repeat(np.array(cbitR, np.int64), a * b)
    return dict(N=N, L1=list(L1), L2=list(L2), a=a, b=b, g1=list(g1), g2=list(g2), group=group, rots=rots,
                cbitR=np.array(cbitR, np.int64), cbitG=cbitG, perms=perms, prot=prot, bonds=bonds, pos=pos,
                rtab=rtab, nbytes=nbytes, bmask=bmask, btype=btype, MK=MK, maskb=(1 << b) - 1, full=(1 << N) - 1,
                FK=((1 << N) - 1) << 1, n1b=int((btype == 0).sum()), n2b=int((btype == 1).sum()))


# ------------------------------------------------------------------ numba kernels
@njit(inline="always")
def popcnt64(x):
    x = x - ((x >> 1) & 0x5555555555555555)
    x = (x & 0x3333333333333333) + ((x >> 2) & 0x3333333333333333)
    x = (x + (x >> 4)) & 0x0F0F0F0F0F0F0F0F
    return (x * 0x0101010101010101) >> 56


@njit(inline="always")
def rot_apply(rtab, mi, s, nbytes):
    y = np.int64(0)
    for byte in range(nbytes):
        y |= rtab[mi, byte, (s >> (8 * byte)) & 255]
    return y


@njit(inline="always")
def translate(y, p, q, a, b, maskb):
    out = np.int64(0)
    for e in range(a):
        blk = (y >> (e * b)) & maskb
        blk = ((blk << q) | (blk >> (b - q))) & maskb
        out |= blk << (((e + p) % a) * b)
    return out


@njit(inline="always")
def is_rep(s, rtab, nbytes, nR, a, b, maskb, full):
    if (s ^ full) < s:
        return False
    for mi in range(nR):
        y = s
        if mi > 0:
            y = rot_apply(rtab, mi, s, nbytes)
        for p in range(a):
            for q in range(b):
                if mi == 0 and p == 0 and q == 0:
                    continue
                x = translate(y, p, q, a, b, maskb)
                if x < s or (x ^ full) < s:
                    return False
    return True


@njit(inline="always")
def images(r, PK, RB, rtab, nbytes, nR, a, b, maskb, cbitR):
    g = 0
    for mi in range(nR):
        y = rot_apply(rtab, mi, r, nbytes)
        for e in range(a):
            blk = (y >> (e * b)) & maskb
            for q in range(b):
                RB[e, q] = ((blk << q) | (blk >> (b - q))) & maskb
        cb = cbitR[mi]
        for p in range(a):
            for q in range(b):
                x = np.int64(0)
                for e in range(a):
                    x |= RB[e, q] << (((e + p) % a) * b)
                PK[g] = (x << 1) | cb
                g += 1


@njit(inline="always")
def target_key(PK, MK, bb, FK):
    best = BIG
    for gg in range(PK.shape[0]):
        kx = PK[gg] ^ MK[bb, gg]
        ky = kx ^ FK
        if ky < kx:
            kx = ky
        if kx < best:
            best = kx
    return best


@njit(inline="always")
def target_key_v(PK, MKb, FK):
    best = BIG
    for gg in range(PK.shape[0]):
        kx = PK[gg] ^ MKb[gg]
        ky = kx ^ FK
        best = min(best, min(kx, ky))
    return best


@njit(cache=True)
def target_one_v(PK, MKb, FK):
    return target_key_v(PK, MKb, FK)


@njit(cache=True)
def images_one(r, PK, rtab, nbytes, nR, a, b, maskb, cbitR):
    RB = np.empty((a, b), np.int64)
    images(r, PK, RB, rtab, nbytes, nR, a, b, maskb, cbitR)


@njit(cache=True)
def target_one(PK, MK, bb, FK):
    return target_key(PK, MK, bb, FK)


@njit(cache=True)
def is_rep_one(s, rtab, nbytes, nR, a, b, maskb, full):
    return is_rep(s, rtab, nbytes, nR, a, b, maskb, full)


@njit(parallel=True, cache=True)
def count_pass(hiList, lowSorted, lowStart, kup, nL, rtab, nbytes, nR, a, b, maskb, full, counts):
    for t in prange(hiList.shape[0]):
        hi = hiList[t]
        q = kup - popcnt64(hi)
        c = 0
        if 0 <= q <= nL:
            for jj in range(lowStart[q], lowStart[q + 1]):
                s = (hi << nL) | lowSorted[jj]
                if is_rep(s, rtab, nbytes, nR, a, b, maskb, full):
                    c += 1
        counts[t] = c


@njit(parallel=True, cache=True)
def write_pass(hiList, lowSorted, lowStart, kup, nL, rtab, nbytes, nR, a, b, maskb, full, offsets, reps):
    for t in prange(hiList.shape[0]):
        hi = hiList[t]
        q = kup - popcnt64(hi)
        o = offsets[t]
        if 0 <= q <= nL:
            for jj in range(lowStart[q], lowStart[q + 1]):
                s = (hi << nL) | lowSorted[jj]
                if is_rep(s, rtab, nbytes, nR, a, b, maskb, full):
                    reps[o] = s
                    o += 1


@njit(parallel=True, cache=True)
def stab_pass(reps, rtab, nbytes, nR, a, b, maskb, full, cbitR, stab, flags):
    for i in prange(reps.shape[0]):
        r = reps[i]
        c = 0
        okB = 1
        for mi in range(nR):
            y = rot_apply(rtab, mi, r, nbytes)
            for p in range(a):
                for q in range(b):
                    x = translate(y, p, q, a, b, maskb)
                    if x == r:
                        c += 1
                        if cbitR[mi] != 0:
                            okB = 0
                    if (x ^ full) == r:
                        c += 1
                        if cbitR[mi] != 0:
                            okB = 0
        stab[i] = c
        flags[i] = okB


@njit(parallel=True, cache=True)
def table_init(T):
    for s in prange(T.shape[0]):
        T[s, 0] = -1.0
        for c in range(1, T.shape[1]):
            T[s, c] = 0.0


@njit(cache=True)
def table_insert(T, reps, slot_of, shift, smask):
    maxprobe = 0
    tot = 0
    for i in range(reps.shape[0]):
        r = reps[i]
        h = np.int64((np.uint64(r) * HC) >> shift)
        pr = 0
        while T[h, 0] >= 0.0:
            h = (h + 1) & smask
            pr += 1
        T[h, 0] = np.float64(r)
        slot_of[i] = h
        tot += pr
        if pr > maxprobe:
            maxprobe = pr
    return maxprobe, tot


@njit(parallel=True, cache=True)
def table_check(T, reps, slot_of, shift, smask, bad):
    for i in prange(reps.shape[0]):
        r = reps[i]
        kf = np.float64(r)
        h = np.int64((np.uint64(r) * HC) >> shift)
        kk = T[h, 0]
        while kk != kf and kk >= 0.0:
            h = (h + 1) & smask
            kk = T[h, 0]
        bad[i] = 0 if (kk == kf and h == slot_of[i]) else 1


@njit(parallel=True, cache=True)
def scatter(T, V, slot_of, stab):
    K = V.shape[0]
    for i in prange(V.shape[1]):
        s = slot_of[i]
        sq = math.sqrt(np.float64(stab[i]))
        for k in range(K):
            T[s, 1 + k] = V[k, i] * sq


@njit(parallel=True, cache=True)
def sweep(T, reps, stab, flags, V, W, J2s, isB, rtab, nbytes, nR, a, b, maskb, cbitR, MK, FK, bmask, btype,
          n1b, n2b, shift, smask, nchunks, nf, PKs, RBs, S1s, S2s, TKs, TTs, THs, DUM):
    # per-chunk scratch: PKs (nchunks, nG), RBs (nchunks, a, b), S1s/S2s (nchunks, K), TKs/TTs/THs (nchunks, nbonds), DUM (nchunks)
    n = reps.shape[0]
    K = V.shape[0]
    nbd = bmask.shape[0]
    cs = (n + nchunks - 1) // nchunks
    for c in prange(nchunks):
        PK = PKs[c]
        RB = RBs[c]
        S1 = S1s[c]
        S2 = S2s[c]
        TK = TKs[c]
        TT = TTs[c]
        TH = THs[c]
        i0 = c * cs
        i1 = min(n, i0 + cs)
        notfound = 0
        dum = 0.0
        for i in range(i0, i1):
            r = reps[i]
            images(r, PK, RB, rtab, nbytes, nR, a, b, maskb, cbitR)
            nt = 0
            na1 = 0
            na2 = 0
            for bb in range(nbd):
                m = bmask[bb]
                xm = r & m
                if xm == 0 or xm == m:
                    continue
                t = btype[bb]
                if t == 0:
                    na1 += 1
                else:
                    na2 += 1
                TK[nt] = target_key_v(PK, MK[bb], FK)
                TT[nt] = t
                nt += 1
            for j in range(nt):
                TH[j] = np.int64((np.uint64(TK[j] >> 1) * HC) >> shift)
            for j in range(nt):
                dum += T[TH[j], 0]
            for k in range(K):
                S1[k] = 0.0
                S2[k] = 0.0
            for j in range(nt):
                best = TK[j]
                kf = np.float64(best >> 1)
                h = TH[j]
                kk = T[h, 0]
                while kk != kf and kk >= 0.0:
                    h = (h + 1) & smask
                    kk = T[h, 0]
                if kk < 0.0:
                    notfound += 1
                    continue
                chi = 1.0 - 2.0 * np.float64(best & 1)
                if TT[j] == 0:
                    for k in range(K):
                        if isB[k] != 0:
                            S1[k] += chi * T[h, 1 + k]
                        else:
                            S1[k] += T[h, 1 + k]
                else:
                    for k in range(K):
                        if isB[k] != 0:
                            S2[k] += chi * T[h, 1 + k]
                        else:
                            S2[k] += T[h, 1 + k]
            isq = 1.0 / math.sqrt(np.float64(stab[i]))
            d1 = np.float64(n1b - 2 * na1)
            d2 = np.float64(n2b - 2 * na2)
            okB = flags[i]
            for k in range(K):
                if isB[k] != 0 and okB == 0:
                    W[k, i] = 0.0
                else:
                    W[k, i] = 2.0 * (S1[k] + J2s[k] * S2[k]) * isq + (d1 + J2s[k] * d2) * V[k, i]
        nf[c] = notfound
        DUM[c] = dum


@njit(parallel=True, cache=True)
def row_dot(A, B, k):
    s = 0.0
    for i in prange(A.shape[1]):
        s += A[k, i] * B[k, i]
    return s


@njit(parallel=True, cache=True)
def row_update(W, V, Vp, k, alpha, beta):
    for i in prange(W.shape[1]):
        W[k, i] -= alpha * V[k, i] + beta * Vp[k, i]


@njit(parallel=True, cache=True)
def row_scale(V, k, c):
    for i in prange(V.shape[1]):
        V[k, i] *= c


@njit(parallel=True, cache=True)
def row_zero(V, k):
    for i in prange(V.shape[1]):
        V[k, i] = 0.0


@njit(parallel=True, cache=True)
def row_axpy(X, k, c, V):
    for i in prange(X.shape[1]):
        X[k, i] += c * V[k, i]


@njit(parallel=True, cache=True)
def row_resid2(HX, X, k, E):
    s = 0.0
    for i in prange(X.shape[1]):
        r = HX[k, i] - E * X[k, i]
        s += r * r
    return s


@njit(parallel=True, cache=True)
def row_random(V, k, flags, needB, seed, nblocks):
    n = V.shape[1]
    bs = (n + nblocks - 1) // nblocks
    for blk in prange(nblocks):
        x = np.uint64(seed) * np.uint64(0x9E3779B97F4A7C15) + np.uint64(blk + 1) * np.uint64(0xBF58476D1CE4E5B9)
        for i in range(blk * bs, min(n, (blk + 1) * bs)):
            x ^= x << np.uint64(13)
            x ^= x >> np.uint64(7)
            x ^= x << np.uint64(17)
            val = np.float64(x >> np.uint64(11)) * (1.0 / 9007199254740992.0) - 0.5
            if needB != 0 and flags[i] == 0:
                V[k, i] = 0.0
            else:
                V[k, i] = val


# ------------------------------------------------------------------ helpers
def build_lowhigh(N, kup, shuffle_seed=12345):
    nL = N // 2; nH = N - nL
    wL = np.arange(1 << nL, dtype=np.int64)
    pL = np.zeros_like(wL)
    for i in range(nL):
        pL += (wL >> i) & 1
    order = np.lexsort((wL, pL)); lowSorted = wL[order]
    lowStart = np.zeros(nL + 2, np.int64)
    for p in range(nL + 1):
        lowStart[p + 1] = lowStart[p] + math.comb(nL, p)
    wH = np.arange(1 << nH, dtype=np.int64)
    pH = np.zeros_like(wH)
    for i in range(nH):
        pH += (wH >> i) & 1
    q = kup - pH
    hiList = wH[(q >= 0) & (q <= nL)]
    hiList = hiList[np.random.default_rng(shuffle_seed).permutation(len(hiList))]
    return nL, lowSorted, lowStart, hiList


def aligned_empty(shape, dtype=np.float64, align=64):
    n = int(np.prod(shape)); isz = np.dtype(dtype).itemsize
    buf = np.empty(n * isz + align, np.uint8)
    off = (-buf.ctypes.data) % align
    return buf[off: off + n * isz].view(dtype).reshape(shape)


def tridiag_lowest(a, b):
    from scipy.linalg import eigh_tridiagonal
    if len(a) == 1:
        return float(a[0]), np.array([1.0])
    w, s = eigh_tridiagonal(np.array(a), np.array(b[: len(a) - 1]), select="i", select_range=(0, 0))
    return float(w[0]), s[:, 0]


def selftest(C, nstates, seed=7):
    """numba images / target search / is_rep against explicit permutations on random S^z = 0 states"""
    rng = np.random.default_rng(seed)
    N = C["N"]; full = C["full"]; perms = C["perms"]; cbitG = C["cbitG"]
    nG = len(perms); PK = np.empty(nG, np.int64)
    pw = [np.array([1 << int(perms[g][i]) for g in range(nG)], dtype=object) for i in range(N)]

    def imgs(s):
        out = np.zeros(nG, dtype=object)
        for i in range(N):
            if (s >> i) & 1:
                out = out + pw[i]
        return [int(v) for v in out]

    nb_checked = 0
    for t in range(nstates):
        s = int(sum(1 << int(i) for i in rng.permutation(N)[: N // 2]))
        images_one(np.int64(s), PK, C["rtab"], C["nbytes"], len(C["rots"]), C["a"], C["b"], np.int64(C["maskb"]), C["cbitR"])
        I = imgs(s)
        exp = [(I[g] << 1) | int(cbitG[g]) for g in range(nG)]
        assert [int(v) for v in PK] == exp, "images mismatch"
        mn = min(min(x, x ^ full) for x in I)
        assert bool(is_rep_one(np.int64(s), C["rtab"], C["nbytes"], len(C["rots"]), C["a"], C["b"], np.int64(C["maskb"]),
                               np.int64(full))) == (s == mn), "is_rep mismatch"
        if t < max(20, nstates // 10):
            for bb, (i, j, typ) in enumerate(C["bonds"]):
                if ((s >> i) & 1) == ((s >> j) & 1):
                    continue
                s2 = s ^ (1 << i) ^ (1 << j)
                best = int(target_one(PK, C["MK"], bb, np.int64(C["FK"])))
                assert int(target_one_v(PK, C["MK"][bb], np.int64(C["FK"]))) == best, "vectorised target search differs"
                I2 = imgs(s2)
                m2 = min(min(x, x ^ full) for x in I2)
                assert best >> 1 == m2, "target rep mismatch"
                cb = {int(cbitG[g]) for g in range(nG) if I2[g] == m2 or (I2[g] ^ full) == m2}
                if len(cb) == 1:
                    assert (best & 1) == cb.pop(), "target character mismatch"
                nb_checked += 1
    return dict(states=nstates, targets=nb_checked)


# ------------------------------------------------------------------ driver
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--L1", required=True, help="e.g. 6,2")
    ap.add_argument("--L2", required=True, help="e.g. -2,6")
    ap.add_argument("--group", default="c4", choices=["c4", "c2"])
    ap.add_argument("--vectors", required=True, help="comma list of SECTOR:J2 (SECTOR A or B), at most 7")
    ap.add_argument("--name", required=True)
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--tol", type=float, default=1e-9)
    ap.add_argument("--maxiter", type=int, default=2000)
    ap.add_argument("--check_every", type=int, default=5)
    ap.add_argument("--seed", type=int, default=20261003)
    ap.add_argument("--expect", default="", help="e.g. A=430909650,B=430909268: abort on mismatch")
    ap.add_argument("--load", type=float, default=0.45)
    ap.add_argument("--selftest", type=int, default=200)
    ap.add_argument("--herm_test", type=int, default=1)
    ap.add_argument("--save_vectors", type=int, default=0)
    ap.add_argument("--dims_only", type=int, default=0)
    args = ap.parse_args()
    os.makedirs(args.outdir, exist_ok=True)
    t00 = time.time()
    code_md5 = hashlib.md5(open(os.path.abspath(__file__), "rb").read()).hexdigest()
    L1 = tuple(int(x) for x in args.L1.split(",")); L2 = tuple(int(x) for x in args.L2.split(","))
    vecs = []
    for tok in args.vectors.split(","):
        sec, j2 = tok.split(":"); assert sec in ("A", "B")
        vecs.append((sec, float(j2)))
    K = len(vecs); assert 1 <= K <= 7
    log = lambda *x: print(time.strftime("%H:%M:%S"), *x, flush=True)
    C = setup_cluster(L1, L2, args.group)
    N = C["N"]; nR = len(C["rots"]); a = C["a"]; b = C["b"]
    log(f"cluster L1={L1} L2={L2} N={N} translations Z_{a} x Z_{b} (g1={C['g1']}, g2={C['g2']}), group {args.group} "
        f"|P|={len(C['perms'])} (x spin flip {2 * len(C['perms'])}), bonds J1 {C['n1b']} J2 {C['n2b']}, threads {nb.get_num_threads()}, md5 {code_md5}")
    rtab = C["rtab"]; nbytes = C["nbytes"]; maskb = np.int64(C["maskb"]); full = np.int64(C["full"]); cbitR = C["cbitR"]
    ts = time.time(); st = selftest(C, args.selftest)
    log(f"selftest passed: {st} in {time.time() - ts:.1f}s")
    # ---- basis
    kup = N // 2
    nL, lowSorted, lowStart, hiList = build_lowhigh(N, kup)
    ts = time.time()
    counts = np.zeros(len(hiList), np.int64)
    count_pass(hiList, lowSorted, lowStart, kup, nL, rtab, nbytes, nR, a, b, maskb, full, counts)
    nrep = int(counts.sum())
    offsets = np.concatenate([[0], np.cumsum(counts)[:-1]]).astype(np.int64)
    reps = np.empty(nrep, np.int64)
    write_pass(hiList, lowSorted, lowStart, kup, nL, rtab, nbytes, nR, a, b, maskb, full, offsets, reps)
    t_enum = time.time() - ts
    ts = time.time()
    stab = np.empty(nrep, np.int16); flags = np.empty(nrep, np.uint8)
    stab_pass(reps, rtab, nbytes, nR, a, b, maskb, full, cbitR, stab, flags)
    dimA = nrep; dimB = int(flags.sum(dtype=np.int64))
    nG2 = 2 * len(C["perms"])
    orbit_sum = int((nG2 // stab.astype(np.int64)).sum())
    log(f"basis: {nrep} orbits (S^z=0 dim {math.comb(N, kup)}, sum of orbit sizes {orbit_sum}) in {t_enum:.0f}s; "
        f"dims A={dimA} B={dimB}; stabiliser/flags {time.time() - ts:.0f}s; max stab {int(stab.max())}")
    assert orbit_sum == math.comb(N, kup), "orbit sizes do not add up to the S^z = 0 dimension"
    if args.expect:
        exp = dict(tok.split("=") for tok in args.expect.split(","))
        got = {"A": dimA, "B": dimB}
        for kk, vv in exp.items():
            if got[kk] != int(vv):
                log(f"DIMENSION MISMATCH {kk}: got {got[kk]} expected {vv}; abort"); sys.exit(3)
        log(f"dimensions match the expected {exp}")
    base = dict(name=args.name, N=N, L1=list(L1), L2=list(L2), group=args.group, translations=[a, b], g1=C["g1"], g2=C["g2"],
                dim_A=dimA, dim_B=dimB, Sz0_dimension=math.comb(N, kup), code="handoff/e1/code/ed40b.py", code_md5=code_md5,
                hamiltonian="Pauli, H = sum_NN sigma_i.sigma_j + J2 sum_NNN sigma_i.sigma_j (J1 = 1), S^z_tot = 0, momentum 0, spin flip even",
                host=socket.gethostname(), numba_threads=nb.get_num_threads(), command=" ".join(sys.argv))
    if args.dims_only:
        json.dump(base, open(os.path.join(args.outdir, f"{args.name}__dims.json"), "w"), indent=1)
        log("DIMS_ONLY_DONE"); return
    # ---- hash table
    nbits = max(10, int(math.ceil(math.log2(nrep / args.load))))
    nslots = 1 << nbits; smask = np.int64(nslots - 1); shift = np.uint64(64 - nbits)
    ts = time.time()
    T = aligned_empty((nslots, 8)); table_init(T)
    slot_of = np.empty(nrep, np.int64)
    maxprobe, totprobe = table_insert(T, reps, slot_of, shift, smask)
    bad = np.empty(nrep, np.uint8); table_check(T, reps, slot_of, shift, smask, bad)
    nbad = int(bad.sum(dtype=np.int64)); del bad
    log(f"hash table: 2^{nbits} slots ({nslots * 64 / 1e9:.1f} GB), load {nrep / nslots:.3f}, insert max probe {maxprobe}, "
        f"mean extra probes {totprobe / nrep:.3f}, lookup check failures {nbad}, {time.time() - ts:.0f}s")
    assert nbad == 0
    J2s = np.array([j for s, j in vecs], np.float64); isB = np.array([1 if s == "B" else 0 for s, j in vecs], np.uint8)
    nchunks = max(1024, 64 * nb.get_num_threads()); nf = np.zeros(nchunks, np.int64)
    MK = C["MK"]; FK = np.int64(C["FK"]); bmask = C["bmask"]; btype = C["btype"]; n1b = C["n1b"]; n2b = C["n2b"]
    PKs = np.zeros((nchunks, MK.shape[1]), np.int64); RBs = np.zeros((nchunks, a, b), np.int64)
    S1s = np.zeros((nchunks, K)); S2s = np.zeros((nchunks, K))
    TKs = np.zeros((nchunks, len(bmask)), np.int64); TTs = np.zeros((nchunks, len(bmask)), np.int64)
    THs = np.zeros((nchunks, len(bmask)), np.int64); DUM = np.zeros(nchunks)
    stats = dict(sweeps=0, seconds=0.0, notfound=0)

    def apply(Vin, Wout, J2use):
        t1 = time.time()
        scatter(T, Vin, slot_of, stab)
        sweep(T, reps, stab, flags, Vin, Wout, J2use, isB, rtab, nbytes, nR, a, b, maskb, cbitR, MK, FK, bmask, btype,
              n1b, n2b, shift, smask, nchunks, nf, PKs, RBs, S1s, S2s, TKs, TTs, THs, DUM)
        stats["sweeps"] += 1; stats["seconds"] += time.time() - t1; stats["notfound"] += int(nf.sum())
        return time.time() - t1

    seeds = [args.seed + 7919 * k for k in range(K)]

    def init_rows(V):
        for k in range(K):
            row_random(V, k, flags, int(isB[k]), seeds[k], 4096)
            row_scale(V, k, 1.0 / math.sqrt(row_dot(V, V, k)))

    # ---- Hermiticity test <u|H v> = <H u|v> on random sector vectors
    herm = None
    if args.herm_test:
        U = np.empty((K, nrep)); Vh = np.empty((K, nrep)); HU = np.empty((K, nrep)); HV = np.empty((K, nrep))
        for k in range(K):
            row_random(U, k, flags, int(isB[k]), seeds[k] + 11, 4096)
            row_random(Vh, k, flags, int(isB[k]), seeds[k] + 13, 4096)
        tsw = apply(U, HU, J2s); apply(Vh, HV, J2s)
        herm = []
        for k in range(K):
            x = row_dot(U, HV, k); y = row_dot(HU, Vh, k)
            herm.append(abs(x - y) / max(abs(x), abs(y), 1e-300))
        del U, Vh, HU, HV
        log(f"hermiticity |<u|Hv>-<Hu|v>|/|<u|Hv>| per vector: {['%.1e' % h for h in herm]}; first sweep {tsw:.1f}s; "
            f"not-found targets {stats['notfound']}")
    # ---- Lanczos pass 1, all vectors in lockstep
    V = np.empty((K, nrep)); Vp = np.zeros((K, nrep)); W = np.empty((K, nrep))
    init_rows(V)
    alphas = [[] for _ in range(K)]; betas = [[] for _ in range(K)]
    active = [True] * K; m = [0] * K; bprev = [0.0] * K; fin = [None] * K
    prog = os.path.join(args.outdir, f"{args.name}__progress.jsonl")
    pf = open(prog, "a"); pf.write(json.dumps(dict(start=time.strftime("%Y-%m-%dT%H:%M:%S"), vectors=vecs, dims=[dimA, dimB])) + "\n")
    t1 = time.time()
    for it in range(args.maxiter):
        tsw = apply(V, W, J2s)
        rec = dict(it=it + 1, t=round(time.time() - t00, 1), sweep_s=round(tsw, 2), k={})
        for k in range(K):
            if not active[k]:
                continue
            al = row_dot(V, W, k); row_update(W, V, Vp, k, al, bprev[k]); be = math.sqrt(row_dot(W, W, k))
            alphas[k].append(al); m[k] = it + 1
            last = (be < 1e-12 * max(1.0, abs(al))) or (it == args.maxiter - 1)
            e = dict(a=al, b=be)
            if (m[k] % args.check_every == 0) or last:
                lam, s = tridiag_lowest(alphas[k], betas[k] + [be]); res = be * abs(s[-1])
                e.update(E=lam, res=res)
                if res < args.tol or last:
                    active[k] = False
                    fin[k] = dict(E_ritz=lam, resEst=res, iterations=m[k], s=s, converged=bool(res < args.tol or be < 1e-12 * max(1.0, abs(al))))
            if active[k]:
                betas[k].append(be); bprev[k] = be
            rec["k"][k] = e
        pf.write(json.dumps(rec) + "\n"); pf.flush()
        if not any(active):
            break
        V, Vp, W = W, V, Vp
        for k in range(K):
            if active[k]:
                row_scale(V, k, 1.0 / bprev[k])
            else:
                row_zero(V, k)
    t_pass1 = time.time() - t1
    log(f"pass 1 done: iterations {m}, {t_pass1:.0f}s, mean sweep {stats['seconds'] / stats['sweeps']:.2f}s")
    for k in range(K):
        log(f"   {vecs[k]}: E_ritz {fin[k]['E_ritz']!r} resEst {fin[k]['resEst']:.2e} it {fin[k]['iterations']}")
    del V, Vp, W
    # ---- pass 2: Ritz vectors
    t2 = time.time()
    X = np.zeros((K, nrep)); V = np.empty((K, nrep)); Vp = np.zeros((K, nrep)); W = np.empty((K, nrep))
    init_rows(V)
    mk = [fin[k]["iterations"] for k in range(K)]; sk = [fin[k]["s"] for k in range(K)]
    for j in range(max(mk)):
        for k in range(K):
            if j < mk[k]:
                row_axpy(X, k, float(sk[k][j]), V)
        if all(j >= mk[k] - 1 for k in range(K)):
            break
        apply(V, W, J2s)
        for k in range(K):
            if j < mk[k] - 1:
                row_update(W, V, Vp, k, alphas[k][j], betas[k][j - 1] if j > 0 else 0.0)
        V, Vp, W = W, V, Vp
        for k in range(K):
            if j < mk[k] - 1:
                row_scale(V, k, 1.0 / betas[k][j])
            else:
                row_zero(V, k)
    del V, Vp
    for k in range(K):
        row_scale(X, k, 1.0 / math.sqrt(row_dot(X, X, k)))
    HX = W
    apply(X, HX, J2s)
    E = [row_dot(X, HX, k) for k in range(K)]
    resid = [math.sqrt(row_resid2(HX, X, k, E[k])) for k in range(K)]
    apply(X, HX, np.zeros(K))
    e1 = [row_dot(X, HX, k) for k in range(K)]
    t_pass2 = time.time() - t2
    log(f"pass 2 done in {t_pass2:.0f}s; total sweeps {stats['sweeps']}, not-found targets {stats['notfound']}")
    if args.save_vectors:
        np.save(os.path.join(args.outdir, f"{args.name}__reps.npy"), reps)
    summ = os.path.join(args.outdir, f"{args.name}__summary.jsonl")
    for k in range(K):
        sec, j2 = vecs[k]
        ps = 4.0 * N
        rec = dict(base, sector=f"{sec}+", sector_text=("q = 0, point-group character trivial" if sec == "A" else
                   ("q = 0, C4 rotation -> -1" if args.group == "c4" else "q = 0, C2 rotation -> -1")) + ", spin flip even",
                   J2=j2, sector_dimension=(dimA if sec == "A" else dimB), E=E[k], E_ritz=fin[k]["E_ritz"],
                   resEst=fin[k]["resEst"], residual=resid[k], converged=fin[k]["converged"], iterations=fin[k]["iterations"],
                   E_per_site_SS=E[k] / ps, E_SS_total=E[k] / 4.0, E_J1bonds=e1[k],
                   s0s1_SS=e1[k] / (4.0 * C["n1b"]), s0s_11_SS=((E[k] - e1[k]) / (4.0 * C["n2b"] * j2) if j2 != 0 else None),
                   hermiticity_rel=(herm[k] if herm else None), sweeps_total=stats["sweeps"],
                   sweep_seconds_mean=round(stats["seconds"] / stats["sweeps"], 3), notfound_targets=stats["notfound"],
                   seconds_pass1=round(t_pass1, 1), seconds_pass2=round(t_pass2, 1), seconds_total=round(time.time() - t00, 1),
                   peak_rss_GB=round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6, 2),
                   alphas=alphas[k], betas=betas[k], seed=seeds[k], tol=args.tol)
        fn = os.path.join(args.outdir, f"{args.name}__{sec}__J2_{j2:g}.json")
        with open(fn + ".tmp", "w") as f:
            json.dump(rec, f, indent=1)
        os.replace(fn + ".tmp", fn)
        with open(summ, "a") as f:
            f.write(json.dumps({kk: rec[kk] for kk in ["sector", "J2", "sector_dimension", "E", "E_ritz", "residual", "iterations",
                                                     "E_SS_total", "s0s1_SS", "s0s_11_SS", "hermiticity_rel"]}) + "\n")
        log(f"RESULT {args.name} {sec}+ J2={j2:g}: E={E[k]!r} (S.S total {E[k] / 4.0:.10f}) ritz={fin[k]['E_ritz']!r} "
            f"residual={resid[k]:.2e} it={fin[k]['iterations']} <s0.s1>={e1[k] / (4.0 * C['n1b']):.6f}")
        if args.save_vectors:
            np.save(os.path.join(args.outdir, f"{args.name}__{sec}__J2_{j2:g}__vec.npy"), X[k])
    log(f"ALL_DONE {args.name} in {time.time() - t00:.0f}s")


if __name__ == "__main__":
    main()
