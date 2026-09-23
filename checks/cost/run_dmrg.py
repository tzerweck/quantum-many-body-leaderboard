#!/usr/bin/env python
"""QMBL cost-to-reproduce run, DMRG: one instance, a bond-dimension ladder, a fixed core count.

Two-site DMRG (TeNPy) on the torus as a finite MPS with long-range couplings, run through
the ladder of maximum bond dimensions in --chi in one process; at the end of each rung the
energy and the wall-clock since process start are recorded, so each rung is a row whose
cost includes the rungs before it (that is what reaching it cost). Energies are computed in
S.S units and stored x4, the Pauli convention of the spin instances (DATA.md).

    OMP_NUM_THREADS=8 python run_dmrg.py --instance J1J2/square_100_P_0.5 --chi 500 1000 2000 --out results/x.json
"""
import argparse
import json
import os
import platform
import socket
import subprocess
import sys
import time

T_START = time.perf_counter()
WALL_START = time.time()

import numpy as np  # noqa: E402

INSTANCES = {
    "J1J2/square_100_P_0.5": dict(model="J1J2", Lx=10, Ly=10, J2=0.5, n_sites=100),
    "Heisenberg/triangular_36_P": dict(model="Heisenberg", Lx=6, Ly=6, n_sites=36),
}


def build(inst_id):
    from tenpy.models.model import CouplingMPOModel
    from tenpy.models.lattice import Square, Triangular
    from tenpy.networks.site import SpinHalfSite
    spec = INSTANCES[inst_id]

    class Model(CouplingMPOModel):
        def init_sites(self, p):
            return SpinHalfSite(conserve="Sz")

        def init_lattice(self, p):
            site = self.init_sites(p)
            Lat = Square if spec["model"] == "J1J2" else Triangular
            return Lat(spec["Lx"], spec["Ly"], site, bc=["periodic", "periodic"], bc_MPS="finite")

        def init_terms(self, p):
            def heis(J, pairs):
                for u1, u2, dx in pairs:
                    self.add_coupling(J / 2, u1, "Sp", u2, "Sm", dx, plus_hc=True)
                    self.add_coupling(J, u1, "Sz", u2, "Sz", dx)
            heis(1.0, self.lat.pairs["nearest_neighbors"])
            if spec["model"] == "J1J2":
                heis(spec["J2"], self.lat.pairs["next_nearest_neighbors"])

    return Model({}), spec


def git_commit(repo_dir):
    try:
        return subprocess.check_output(["git", "-C", repo_dir, "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        return None


def cpu_model():
    try:
        for line in open("/proc/cpuinfo"):
            if line.startswith("model name"):
                return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or platform.machine()


def lanczos_stats(eng):
    # What the DMRG FLOP model (scripts/flops.mjs, dmrg-v1) needs from a run and TeNPy decides
    # adaptively: how many effective-Hamiltonian applications the two-site updates took.
    n = [int(x) for x in eng.update_stats.get("N_lanczos", [])]
    return dict(updates=len(n), applications=sum(n), mean=sum(n) / len(n) if n else None, min=min(n, default=None), max=max(n, default=None))


def hms(seconds):
    s = int(round(seconds))
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--instance", choices=sorted(INSTANCES), required=True)
    ap.add_argument("--chi", type=int, nargs="+", default=[500, 1000, 2000])
    ap.add_argument("--max-sweeps", type=int, default=15)
    ap.add_argument("--max-e-err", type=float, default=1e-6)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    import tenpy
    from tenpy.networks.mps import MPS
    from tenpy.algorithms import dmrg
    tenpy.tools.misc.setup_logging(to_stdout="INFO")

    M, spec = build(args.instance)
    n = spec["n_sites"]
    psi = MPS.from_product_state(M.lat.mps_sites(), ["up", "down"] * (n // 2), bc="finite")
    cores = int(os.environ.get("OMP_NUM_THREADS") or os.environ.get("SLURM_CPUS_PER_TASK") or 1)
    print(f"DMRG on {args.instance}: {n} sites, MPO bond dimension {max(M.H_MPO.chi)}, {cores} cores, chi ladder {args.chi}", flush=True)

    rungs = []
    for chi in args.chi:
        # max_trunc_err is TeNPy's consistency check, not a convergence target: at chi = 500 on a
        # torus the truncation error is above its 1e-4 default and the rung is still a row.
        # A new engine per rung: updating the options of a running engine left chi_max at its
        # first value, so the 1000 and 2000 rungs of job 14765882 ran at 500 (chi_reached says so).
        params = dict(trunc_params=dict(chi_max=chi, svd_min=1e-10), mixer=True, max_sweeps=args.max_sweeps,
                      max_E_err=args.max_e_err, min_sweeps=4, combine=True, max_trunc_err=1.0)
        eng = dmrg.TwoSiteDMRGEngine(psi, M, params)
        E, psi = eng.run()
        assert int(max(psi.chi)) <= chi
        t = time.perf_counter() - T_START
        rung = dict(chi_max=chi, chi_reached=int(max(psi.chi)), energy_SS=float(E), energy=4 * float(E), energy_per_site_SS=float(E) / n,
                    sweeps=int(eng.sweeps), max_trunc_err=float(max(eng.trunc_err_list)) if eng.trunc_err_list else None,
                    entanglement_entropy_max=float(max(psi.entanglement_entropy())), wall_seconds=t, wall_hms=hms(t), cpu_core_hours=t / 3600 * cores,
                    chi_profile=[int(c) for c in psi.chi], lanczos=lanczos_stats(eng))
        rungs.append(rung)
        print(f"RUNG chi={chi}: E = {rung['energy']:.6f} (Pauli, total), E/N = {rung['energy_per_site_SS']:.7f} S.S, sweeps {rung['sweeps']}, "
              f"max trunc err {rung['max_trunc_err']}, wall {rung['wall_hms']} = {rung['cpu_core_hours']:.2f} core-h", flush=True)
        with open(args.out, "w") as f:
            json.dump(dict(schema="qmbl-cost-run-dmrg-1", instance_id=args.instance, label="DMRG", rungs=rungs, cores=cores,
                           protocol=dict(algorithm="two-site DMRG, TeNPy, finite MPS on the torus with long-range couplings, Sz conserved, Neel product start, mixer on, a new engine per rung on the previous rung's state",
                                         max_sweeps=args.max_sweeps, max_E_err=args.max_e_err, svd_min=1e-10, mpo_bond_dimension=int(max(M.H_MPO.chi))),
                           hardware=dict(host=socket.gethostname(), cpu=cpu_model(), slurm_job_id=os.environ.get("SLURM_JOB_ID"),
                                         slurm_partition=os.environ.get("SLURM_JOB_PARTITION"), cores=cores),
                           software=dict(python=platform.python_version(), tenpy=tenpy.__version__, numpy=np.__version__, script="checks/cost/run_dmrg.py",
                                         commit=os.environ.get("QMBL_COMMIT") or git_commit(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")), argv=sys.argv[1:]),
                           timing=dict(started_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(WALL_START)), ended_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))),
                      f, indent=1)


if __name__ == "__main__":
    main()
