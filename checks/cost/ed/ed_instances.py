"""Hamiltonians of the instances QMBL measures an ED cost on (checks/cost/README.md, "QMBL-measured ED cost").

Conventions are VarBench's (vendor/varbench/<Model>/README.md), stored energies total:
  Heisenberg, J1-J2   H = J1 sum_<ij> s_i.s_j + J2 sum_<<ij>> s_i.s_j   with Pauli matrices
  TFIsing             H = sum_<ij> sz_i sz_j + Gamma sum_i sx_i          Pauli
  Hubbard             H = -sum_<ij>,s (c+_is c_js + h.c.) + U sum_i n_iu n_id
  t-V (spinless)      H = -sum_<ij> (c+_i c_j + h.c.) + V sum_<ij> n_i n_j
  single-band Anderson impurity: e0 n_d + U n_du n_dd + sum_l eps_l n_l + sum_l (V_l d+ c_l + h.c.), per spin,
      bath parameters from VarBench's HamParams/<model>.h5, U from its run scripts.
Only particle number or total Sz is conserved (Tristan, 2026-09-24): no lattice symmetry, so the
cost is that of plain sparse Lanczos in a standard tool. Every build is checked against the stored
exact energy by run_ed.py before its cost counts.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# VarBench's 18-site kagome cluster (programs/dmrg_itensors/heisenberg_kagome.jl, varbench/methods ed31bb0).
KAGOME_2X3 = [(0, 1), (0, 2), (0, 4), (0, 17), (1, 2), (1, 3), (1, 14), (2, 7), (2, 9), (3, 4), (3, 5), (3, 14), (4, 5), (4, 17),
              (5, 6), (5, 10), (6, 7), (6, 8), (6, 10), (7, 8), (7, 9), (8, 13), (8, 15), (9, 10), (9, 11), (10, 11), (11, 12),
              (11, 16), (12, 13), (12, 14), (12, 16), (13, 14), (13, 15), (15, 16), (15, 17), (16, 17)]

# Single-band impurity models: U and the parameter file, from VarBench's scripts (scripts/Impurity/SB-*.py) and
# vendor/varbench/Impurity/HamParams (copied to ed/impurity/).
IMPURITY = {
    "SB-IMP_9": dict(U=2.0, h5="SB-IMP_9.h5"),
    "SB-DMFT-MT-HF_9": dict(U=4.0, h5="SB-DMFT-MT-HF_9.h5"),
    "SB-DMFT-MT-AHF_9": dict(U=4.0, h5="SB-DMFT-MT-AHF_9.h5"),
    "SB-DMFT-MI-HF_9": dict(U=8.0, h5="SB-DMFT-MI_9.h5"),
}


def _dedupe(edges):
    return sorted({(min(a, b), max(a, b)) for a, b in edges if a != b})


def lattice_edges(inst):
    """(nearest, next-nearest) edge lists, 0-based, for the instance's lattice."""
    lat, bc, N = inst["lattice"], inst["boundary"], inst["n_sites"]
    if lat == "chain":
        nn = [(i, i + 1) for i in range(N - 1)] + ([(N - 1, 0)] if bc == "P" else [])
        return _dedupe(nn), []
    if lat == "kagome-2x3":
        return _dedupe(KAGOME_2X3), []
    if lat in ("square", "triangular") or lat.startswith("rectangular-"):
        assert bc == "P", f"{inst['instance_id']}: only periodic clusters are built"
        if lat.startswith("rectangular-"):
            Lx, Ly = (int(x) for x in lat.split("-")[1].split("x"))
        else:
            Lx = Ly = int(round(N ** 0.5))
        assert Lx * Ly == N
        at = lambda x, y: (x % Lx) + Lx * (y % Ly)
        nn, nnn = [], []
        for y in range(Ly):
            for x in range(Lx):
                nn += [(at(x, y), at(x + 1, y)), (at(x, y), at(x, y + 1))]
                if lat == "triangular":
                    nn.append((at(x, y), at(x + 1, y - 1)))
                else:
                    nnn += [(at(x, y), at(x + 1, y + 1)), (at(x, y), at(x + 1, y - 1))]
        return _dedupe(nn), _dedupe(nnn)
    raise ValueError(f"{inst['instance_id']}: lattice {lat} is not defined here")


def build(inst):
    """(hilbert, operator, description of the conserved sector) for one worklist entry."""
    import netket as nk
    from netket.operator import FermionOperator2nd

    model, N, p = inst["model"], inst["n_sites"], inst.get("params") or {}
    if model in ("Heisenberg", "J1J2"):
        nn, nnn = lattice_edges(inst)
        J2 = float(p.get("J2", 0.0)) if model == "J1J2" else 0.0
        edges = [(a, b, 0) for a, b in nn] + ([(a, b, 1) for a, b in nnn] if J2 else [])
        g = nk.graph.Graph(edges=edges)
        hi = nk.hilbert.Spin(0.5, N, total_sz=0)
        # NetKet's Heisenberg is J sigma.sigma per bond (Pauli); no sign rule, so H is exactly VarBench's.
        H = nk.operator.Heisenberg(hi, g, J=[1.0, J2] if J2 else 1.0, sign_rule=False)
        return hi, H, "total Sz = 0"
    if model == "TFIsing":
        nn, _ = lattice_edges(inst)
        hi = nk.hilbert.Spin(0.5, N)
        sz, sx = nk.operator.spin.sigmaz, nk.operator.spin.sigmax
        H = sum(sz(hi, a) * sz(hi, b) for a, b in nn) + float(p["h"]) * sum(sx(hi, i) for i in range(N))
        return hi, H, "none"
    if model == "Hubbard":
        nn, _ = lattice_edges(inst)
        nf = int(p["Nf"])
        hi = nk.hilbert.SpinOrbitalFermions(N, s=1 / 2, n_fermions_per_spin=(nf, nf))
        up, dn = (lambda i: i), (lambda i: i + N)  # orbital index: one block of N sites per spin
        terms, weights = [], []
        for a, b in nn:
            for o in (up, dn):
                terms += [((o(a), 1), (o(b), 0)), ((o(b), 1), (o(a), 0))]
                weights += [-1.0, -1.0]
        for i in range(N):
            terms.append(((up(i), 1), (up(i), 0), (dn(i), 1), (dn(i), 0)))
            weights.append(float(p["U"]))
        return hi, FermionOperator2nd(hi, terms, weights), f"N_up = N_dn = {nf}"
    if model == "tV":
        nn, _ = lattice_edges(inst)
        nf = int(p["Nf"])
        hi = nk.hilbert.SpinOrbitalFermions(N, n_fermions=nf)
        terms, weights = [], []
        for a, b in nn:
            terms += [((a, 1), (b, 0)), ((b, 1), (a, 0)), ((a, 1), (a, 0), (b, 1), (b, 0))]
            weights += [-1.0, -1.0, float(p["V"])]
        return hi, FermionOperator2nd(hi, terms, weights), f"N = {nf}"
    if model == "Impurity":
        import h5py
        name = inst["instance_id"].split("/")[1]
        spec = IMPURITY[name]
        with h5py.File(os.path.join(HERE, "impurity", spec["h5"]), "r") as f:
            spins = {}
            for key in ("up", "down"):
                e0 = float(f["e0"]["hloc"][key][()][0, 0, 0])
                baths = f["bath"]["bath"][key]["0"]
                ls = sorted(baths.keys(), key=int)
                eps = [float(baths[l]["eps"][()]) for l in ls]
                V = [complex(*baths[l]["V"][()][0]) for l in ls]
                spins[key] = (e0, eps, V)
        L = 1 + len(spins["up"][1])  # impurity + bath sites per spin
        dof = inst["exact"][0]["dof"]
        nup, ndn = (dof + 1) // 2, dof // 2
        hi = nk.hilbert.SpinOrbitalFermions(L, s=1 / 2, n_fermions_per_spin=(nup, ndn))
        terms, weights = [], []
        for s, key in enumerate(("up", "down")):
            e0, eps, V = spins[key]
            o = lambda i, s=s: i + s * L
            terms.append(((o(0), 1), (o(0), 0))); weights.append(e0)
            for l, (e, v) in enumerate(zip(eps, V), start=1):
                terms.append(((o(l), 1), (o(l), 0))); weights.append(e)
                terms += [((o(0), 1), (o(l), 0)), ((o(l), 1), (o(0), 0))]; weights += [v, v.conjugate()]
        terms.append(((0, 1), (0, 0), (L, 1), (L, 0))); weights.append(spec["U"])
        dtype = complex if any(abs(v.imag) > 0 for s in spins.values() for v in s[2]) else float
        if dtype is float:
            weights = [w.real if isinstance(w, complex) else w for w in weights]
        return hi, FermionOperator2nd(hi, terms, weights, dtype=dtype), f"N_up = {nup}, N_dn = {ndn} ({L} sites per spin)"
    raise ValueError(f"model {model}")
