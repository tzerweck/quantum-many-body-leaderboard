#!/usr/bin/env python
"""QMBL cost-to-reproduce run: one ansatz, one instance, one GPU, the protocol in README.md.

Trains a NetKet variational state for a fixed number of steps, measures the wall-clock from
process start (JIT compilation included) to the end of the final evaluation, and writes one
results JSON that scripts/add_cost_runs.mjs turns into a row with `computed_by: "qmbl"`.
Nothing in the output is estimated: the clock is measured, the energy is sampled at the end
with its error bar, autocorrelation time and R-hat, and the counts are the ones that ran.

    python run_nqs.py --instance J1J2/square_100_P_0.5 --model rbm --out results/x.json
    python run_nqs.py --ed-check          # small-lattice ED against known S.S energies

Energies are in NetKet's convention for `Heisenberg`, Pauli matrices (sigma.sigma), which is
the instance's stored convention for spin models (DATA.md; per site in S.S = E / 4N).
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
    # instance_id: how to build it. Both are spin-1/2, total S_z = 0, periodic, Pauli units.
    "J1J2/square_100_P_0.5": dict(model="J1J2", L=10, J2=0.5, n_sites=100),
    "Heisenberg/triangular_36_P": dict(model="Heisenberg", L=6, n_sites=36),
}

# One protocol for every ansatz (README.md): the same sampler, sample count, step count,
# optimizer and final evaluation. Stochastic reconfiguration with a shift RELATIVE to the
# diagonal of the quantum geometric tensor (S + 1e-6 I + 0.01 diag S): an absolute shift
# is a per-model guess, since the log-derivatives of a translation-symmetric network are
# N times those of a dense one, and 0.01 absolute sent the symmetric RBM and the GCNN on
# 10x10 to 1e37 in two steps (smoke jobs). The linear system is solved by Cholesky where
# the dense S fits (up to 30000 parameters) and by conjugate gradients on the Jacobian
# otherwise; that choice is recorded on the row.
PROTOCOL = dict(n_samples=4096, n_chains=1024, n_discard_per_chain=16, steps=2000, lr=0.01,
                diag_shift=1e-6, diag_scale=0.01, dense_solver_max_params=30000, cg_maxiter=300,
                eval_samples=131072, eval_chains=1024, eval_discard_per_chain=64, seed=20260921)

MODELS = {
    # name: label, and the chunk of configurations the network sees at once. The chunk is
    # memory management only (the local energy of 4096 samples on J1-J2 10x10 is 1.6 million
    # configurations, and a symmetrised network expands each by the group); it changes no
    # number and the wall-clock includes whatever it costs.
    "rbm": dict(label="RBM (alpha = 1)", chunk=16384),
    "rbmsymm": dict(label="RBM, translation-symmetric (alpha = 4)", chunk=4096),
    "gcnn": dict(label="GCNN (translations, 4 layers, 8 features)", chunk=1024),
    "vit": dict(label="ViT (factored attention, 2x2 patches, d = 60, 4 layers, 10 heads)", chunk=1024),
}


def build_instance(inst_id):
    import netket as nk
    spec = INSTANCES[inst_id]
    if spec["model"] == "J1J2":
        g = nk.graph.Square(spec["L"], pbc=True, max_neighbor_order=2)
        hi = nk.hilbert.Spin(s=1 / 2, N=g.n_nodes, total_sz=0)
        H = nk.operator.Heisenberg(hi, g, J=[1.0, spec["J2"]], sign_rule=[True, False])
        n_conn = len(g.edges(filter_color=0)) + len(g.edges(filter_color=1))
    else:
        g = nk.graph.Triangular(extent=[spec["L"], spec["L"]], pbc=True)
        hi = nk.hilbert.Spin(s=1 / 2, N=g.n_nodes, total_sz=0)
        H = nk.operator.Heisenberg(hi, g, J=1.0, sign_rule=False)
        n_conn = g.n_edges
    assert g.n_nodes == spec["n_sites"], (g.n_nodes, spec)
    return g, hi, H, n_conn


def build_model(name, g):
    import netket as nk
    if name == "rbm":
        return nk.models.RBM(alpha=1, param_dtype=complex)
    if name == "rbmsymm":
        # NetKet's default initialisation, summed over the N translations, spreads the initial
        # log-amplitudes over hundreds of nats on 100 sites (step-0 variance 2e10 in the smoke
        # job, NaN at step 1); the kernel starts at 0.01 / sqrt(N) instead.
        import jax
        init = jax.nn.initializers.normal(stddev=0.01 / np.sqrt(g.n_nodes))
        return nk.models.RBMSymm(symmetries=g.translation_group(), alpha=4, param_dtype=complex, kernel_init=init, hidden_bias_init=init)
    if name == "gcnn":
        # Translations only: over the full space group (800 elements on 10x10) a step took
        # ~140 s in the smoke job, 78 h for the protocol; the group's size enters squared.
        return nk.models.GCNN(symmetries=g.translation_group(), layers=4, features=8, param_dtype=complex)
    if name == "vit":
        from vit import ViT
        return ViT(L=int(round(np.sqrt(g.n_nodes))), patch=2, d=60, heads=10, layers=4)
    raise ValueError(name)


def count_params(vs):
    import jax
    return int(sum(x.size for x in jax.tree_util.tree_leaves(vs.parameters)))


def git_commit(repo_dir):
    try:
        return subprocess.check_output(["git", "-C", repo_dir, "rev-parse", "--short", "HEAD"], text=True).strip()
    except Exception:
        return None


def hms(seconds):
    s = int(round(seconds))
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


def ed_check():
    """NetKet's Heisenberg is in Pauli units: 4 x 4 periodic square must give 16 x 4 x (-0.7017802)."""
    import netket as nk
    g = nk.graph.Square(4, pbc=True)
    hi = nk.hilbert.Spin(s=1 / 2, N=16, total_sz=0)
    H = nk.operator.Heisenberg(hi, g, J=1.0)
    e = nk.exact.lanczos_ed(H, k=1)[0]
    print("4x4 square Heisenberg, PBC:", e, "per site S.S =", e / 64, "(literature -0.7017802)")
    g = nk.graph.Square(4, pbc=True, max_neighbor_order=2)
    H = nk.operator.Heisenberg(hi, g, J=[1.0, 0.5], sign_rule=[True, False])
    e = nk.exact.lanczos_ed(H, k=1)[0]
    print("4x4 J1-J2 = 0.5, PBC:", e, "per site S.S =", e / 64, "(literature -0.5286)")
    assert abs(e / 64 + 0.5286) < 2e-3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--instance", choices=sorted(INSTANCES))
    ap.add_argument("--model", choices=sorted(MODELS))
    ap.add_argument("--out", help="results JSON")
    ap.add_argument("--steps", type=int, default=PROTOCOL["steps"])
    ap.add_argument("--n-samples", type=int, default=PROTOCOL["n_samples"])
    ap.add_argument("--eval-samples", type=int, default=PROTOCOL["eval_samples"])
    ap.add_argument("--seed", type=int, default=PROTOCOL["seed"])
    ap.add_argument("--checkpoint-every", type=int, default=100)
    ap.add_argument("--ed-check", action="store_true")
    args = ap.parse_args()
    if args.ed_check:
        return ed_check()
    if not (args.instance and args.model and args.out):
        ap.error("--instance, --model and --out are required")

    import jax
    import netket as nk
    import flax
    import optax  # noqa: F401

    devices = jax.devices()
    print("devices:", devices, flush=True)
    g, hi, H, n_conn = build_instance(args.instance)
    model = build_model(args.model, g)
    m = MODELS[args.model]

    sampler = nk.sampler.MetropolisExchange(hi, graph=g, d_max=2, n_chains=PROTOCOL["n_chains"])
    vs = nk.vqs.MCState(sampler, model, n_samples=args.n_samples, n_discard_per_chain=PROTOCOL["n_discard_per_chain"],
                        seed=args.seed, sampler_seed=args.seed + 1, chunk_size=m["chunk"])
    n_params = count_params(vs)
    print(f"{args.model} on {args.instance}: {n_params} parameters, n_conn {n_conn}", flush=True)

    import functools
    opt = nk.optimizer.Sgd(learning_rate=PROTOCOL["lr"])
    dense = n_params <= PROTOCOL["dense_solver_max_params"]
    solver = nk.optimizer.solver.cholesky if dense else functools.partial(jax.scipy.sparse.linalg.cg, maxiter=PROTOCOL["cg_maxiter"])
    sr = nk.optimizer.SR(qgt=nk.optimizer.qgt.QGTJacobianDense(chunk_size=m["chunk"]), solver=solver,
                         diag_shift=PROTOCOL["diag_shift"], diag_scale=PROTOCOL["diag_scale"])
    solve_desc = "Cholesky on the dense S" if dense else f"conjugate gradients, {PROTOCOL['cg_maxiter']} iterations max"
    optimizer_desc = f"SR (QGTJacobianDense, {solve_desc}, diag_shift {PROTOCOL['diag_shift']}, diag_scale {PROTOCOL['diag_scale']})"
    driver = nk.driver.VMC(H, opt, variational_state=vs, preconditioner=sr)

    out_dir = os.path.dirname(os.path.abspath(args.out))
    os.makedirs(out_dir, exist_ok=True)
    stem = os.path.splitext(os.path.abspath(args.out))[0]
    trace_path, ckpt_path = stem + ".trace.jsonl", stem + ".params.msgpack"
    trace = open(trace_path, "w")
    t_train0 = time.perf_counter()
    step_times = []

    def cb(step, log_data, driver):
        e = log_data["Energy"]
        now = time.perf_counter()
        step_times.append(now)
        rec = dict(step=step, t=now - T_START, mean=float(np.real(e.mean)), sigma=float(e.error_of_mean),
                   variance=float(e.variance), tau=float(e.tau_corr), r_hat=float(e.R_hat))
        trace.write(json.dumps(rec) + "\n")
        if step % 20 == 0:
            trace.flush()
            print(f"step {step:5d}  t={rec['t']:8.1f}s  E={rec['mean']:.6f} ± {rec['sigma']:.6f}  var={rec['variance']:.4f}  tau={rec['tau']:.2f}  Rhat={rec['r_hat']:.3f}", flush=True)
        if args.checkpoint_every and step and step % args.checkpoint_every == 0:
            with open(ckpt_path, "wb") as f:
                f.write(flax.serialization.to_bytes(vs.variables))
        return True

    driver.run(n_iter=args.steps, callback=cb, show_progress=False)
    t_train1 = time.perf_counter()
    trace.close()
    with open(ckpt_path, "wb") as f:
        f.write(flax.serialization.to_bytes(vs.variables))

    # Final evaluation: fresh, longer chains, many more samples, NetKet's own error of the
    # mean (blocked, autocorrelation-corrected), tau and R-hat reported with it.
    vs.n_samples = args.eval_samples
    vs.n_discard_per_chain = PROTOCOL["eval_discard_per_chain"]
    vs.sampler = nk.sampler.MetropolisExchange(hi, graph=g, d_max=2, n_chains=PROTOCOL["eval_chains"])
    vs.reset()
    E = vs.expect(H)
    t_end = time.perf_counter()

    wall = t_end - T_START
    n_sites = INSTANCES[args.instance]["n_sites"]
    result = dict(
        schema="qmbl-cost-run-1",
        instance_id=args.instance, model=args.model, label=m["label"],
        energy=float(np.real(E.mean)), sigma=float(E.error_of_mean), energy_variance=float(E.variance),
        tau_corr=float(E.tau_corr), r_hat=float(E.R_hat),
        energy_per_site_SS=float(np.real(E.mean)) / (4 * n_sites),
        eval=dict(samples=int(args.eval_samples), chains=PROTOCOL["eval_chains"], discard_per_chain=PROTOCOL["eval_discard_per_chain"]),
        train=dict(steps=args.steps, n_samples=args.n_samples, n_chains=PROTOCOL["n_chains"], n_discard_per_chain=PROTOCOL["n_discard_per_chain"],
                   optimizer=optimizer_desc, lr=PROTOCOL["lr"], diag_shift=PROTOCOL["diag_shift"], diag_scale=PROTOCOL["diag_scale"],
                   sampler="MetropolisExchange, d_max 2", seed=args.seed, chunk_size=m["chunk"]),
        parameters=n_params, n_conn=n_conn,
        timing=dict(wall_seconds=wall, wall_hms=hms(wall), setup_seconds=t_train0 - T_START, train_seconds=t_train1 - t_train0,
                    eval_seconds=t_end - t_train1, seconds_per_step_last_100=float(np.mean(np.diff(step_times[-101:]))) if len(step_times) > 101 else None,
                    started_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(WALL_START)), ended_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
        hardware=dict(devices=[str(d) for d in devices], device_kind=devices[0].device_kind, n_devices=len(devices), host=socket.gethostname(),
                      slurm_job_id=os.environ.get("SLURM_JOB_ID"), slurm_partition=os.environ.get("SLURM_JOB_PARTITION"), cpus=os.environ.get("SLURM_CPUS_PER_TASK")),
        software=dict(python=platform.python_version(), netket=nk.__version__, jax=jax.__version__, flax=flax.__version__,
                      script="checks/cost/run_nqs.py", commit=os.environ.get("QMBL_COMMIT") or git_commit(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")), argv=sys.argv[1:]),
        files=dict(trace=os.path.basename(trace_path), params=os.path.basename(ckpt_path)),
    )
    with open(args.out, "w") as f:
        json.dump(result, f, indent=1)
    print(f"FINAL {args.model} {args.instance}: E = {result['energy']:.6f} ± {result['sigma']:.6f} (Pauli, total), "
          f"E/N = {result['energy_per_site_SS']:.7f} S.S, var {result['energy_variance']:.4f}, tau {result['tau_corr']:.2f}, Rhat {result['r_hat']:.3f}; "
          f"wall {hms(wall)} on {len(devices)} x {devices[0].device_kind}; {n_params} parameters, {args.steps} steps x {args.n_samples} samples", flush=True)


if __name__ == "__main__":
    main()
