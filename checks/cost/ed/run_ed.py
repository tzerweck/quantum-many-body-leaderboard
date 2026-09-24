#!/usr/bin/env python
"""QMBL-measured ED cost: exact diagonalization of one instance, timed (checks/cost/README.md).

Build the Hamiltonian in the conserved sector (ed_instances.py), store it as a sparse matrix
(NetKet's to_sparse), and find the lowest eigenvalue with SciPy's eigsh (ARPACK, implicitly
restarted Lanczos) through an operator that counts the matrix-vector products: that count is
the Lanczos steps. The energy must reproduce the stored exact energy (relative 1e-8) or the run
says so and its cost is not attached. Wall-clock from process start to the eigenvalue, imports
and matrix construction included, on the cores the job was given; the protocol v1.4 resources
block beside it.

    OMP_NUM_THREADS=1 python run_ed.py --instance Heisenberg/square_16_P --out ed/results/x.json
"""
import argparse
import json
import os
import platform
import resource
import socket
import subprocess
import sys
import time

T_START = time.perf_counter()
WALL_START = time.time()
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from monitor import Monitor  # noqa: E402
MON = Monitor()

TOL_REL = 1e-8


def hms(seconds):
    s = int(round(seconds))
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


def cpu_model():
    try:
        for line in open("/proc/cpuinfo"):
            if line.startswith("model name"):
                return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or platform.machine()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--instance", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--worklist", default=os.path.join(HERE, "worklist.json"))
    args = ap.parse_args()
    inst = next(w for w in json.load(open(args.worklist)) if w["instance_id"] == args.instance)

    import numpy as np
    import scipy
    import scipy.sparse.linalg as sla
    import netket as nk
    from ed_instances import build

    t0 = time.perf_counter()
    hi, H, sector = build(inst)
    t1 = time.perf_counter()
    A = H.to_sparse().tocsr()
    t2 = time.perf_counter()
    count = [0]

    def matvec(v):
        count[0] += 1
        return A @ v

    op = sla.LinearOperator(A.shape, matvec=matvec, dtype=A.dtype)
    E = float(np.real(sla.eigsh(op, k=1, which="SA", return_eigenvectors=False)[0]))
    t3 = time.perf_counter()

    wall = t3 - T_START
    cores = int(os.environ.get("SLURM_CPUS_PER_TASK") or os.environ.get("OMP_NUM_THREADS") or 1)
    stored = [e["energy"] for e in inst["exact"]]
    ref = min(stored, key=lambda e: abs(e - E))
    rel = abs(E - ref) / abs(ref)
    result = dict(
        schema="qmbl-ed-cost-1", instance_id=args.instance,
        energy=E, stored_exact=ref, relative_difference=rel, reproduces_stored=rel < TOL_REL,
        sector=dict(conserved=sector, dimension=int(A.shape[0]), nonzeros=int(A.nnz), dtype=str(A.dtype),
                    lattice_symmetries="none (Tristan, 2026-09-24: plain sparse Lanczos in a standard tool)"),
        lanczos_steps=count[0],
        timing=dict(wall_seconds=wall, wall_hms=hms(wall), import_seconds=t0 - T_START, build_seconds=t1 - t0,
                    sparse_seconds=t2 - t1, solve_seconds=t3 - t2,
                    started_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(WALL_START)), ended_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
        cores=cores, cpu_core_hours=wall / 3600 * cores,
        peak_rss_gb=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6,
        hardware=dict(cpu=cpu_model(), host=socket.gethostname(), slurm_job_id=os.environ.get("SLURM_JOB_ID"),
                      slurm_partition=os.environ.get("SLURM_JOB_PARTITION"), cores=cores),
        software=dict(python=platform.python_version(), netket=nk.__version__, scipy=scipy.__version__, numpy=np.__version__,
                      eigensolver="scipy.sparse.linalg.eigsh (ARPACK), k = 1, which = SA, default tolerance",
                      script="checks/cost/ed/run_ed.py", commit=os.environ.get("QMBL_COMMIT"), argv=sys.argv[1:]),
        resources=MON.summary(),
    )
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(result, f, indent=1)
    print(f"ED {args.instance}: E = {E:.12f} (stored {ref:.12f}, rel {rel:.1e}, {'OK' if rel < TOL_REL else 'MISMATCH'}); "
          f"dim {A.shape[0]}, nnz {A.nnz}, {count[0]} Lanczos steps; wall {hms(wall)} "
          f"(build {t1 - t0:.1f} s, sparse {t2 - t1:.1f} s, solve {t3 - t2:.1f} s) on {cores} core(s), peak {result['peak_rss_gb']:.1f} GB", flush=True)


if __name__ == "__main__":
    main()
