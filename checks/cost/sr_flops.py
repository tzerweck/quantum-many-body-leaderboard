#!/usr/bin/env python
"""Count the arithmetic of one stochastic-reconfiguration step of each QMBL cost run.

The SR step is built exactly as run_nqs.py builds it (NetKet's SR with QGTJacobianDense at the
run's chunk size, the relative diagonal shift, Cholesky on the dense S where there are no more
real parameters than samples and conjugate gradients otherwise), on the run's 4096 samples, and
traced by JAX in two parts:

- `jacobian`: constructing the QGT, i.e. the per-sample Jacobian NetKet computes for it (in the
  mode it chooses for the network: "complex" splits complex parameters into real pairs and the
  output into its real and imaginary parts);
- `solve`: the rest of the step, the whole SR call minus the construction. For Cholesky that is
  forming S and solving; for conjugate gradients the loop body is counted once and reported as
  `cg_iteration` (the runs do not log how many iterations each step took).

FLOPs are counted as in forward_flops.py (whose counter this imports), with a Cholesky
factorisation of order n at n^3/3 and a triangular solve at n^2 per right-hand side, four times
that for complex matrices. The samples come from the run's own sampler (without discards, since
they do not enter a count).

    JAX_ENABLE_X64=1 JAX_PLATFORMS=cpu python sr_flops.py --out sr-flops.json
"""
import argparse
import functools
import hashlib
import json
import math
import time

import forward_flops as ff  # also puts run_nqs.py on the path, with its resource monitor stubbed out
from run_nqs import MODELS, PROTOCOL, build_instance, build_model, count_params, count_real_params

import jax
import jax.numpy as jnp
import numpy as np

RUNS = [(i, m) for i in ("J1J2/square_100_P_0.5", "Heisenberg/triangular_36_P") for m in ("rbm", "rbmsymm", "gcnn", "vit")]
KEYS = ("dot", "conv", "fft", "elementwise", "reduce", "linalg", "transcendentals")

_original = ff.count_jaxpr


class _One:
    """A jaxpr of one equation, to hand to the forward-pass counter."""
    def __init__(self, eqn):
        self.eqns = [eqn]


def _snapshot(c):
    return {k: c.get(k, 0) for k in KEYS}


def count_jaxpr(jaxpr, c, mult=1):
    """forward_flops.count_jaxpr plus the linear algebra of an SR solve."""
    c.setdefault("linalg", 0)
    c.setdefault("while_bodies", [])
    for eqn in jaxpr.eqns:
        p = eqn.primitive.name
        ins = [v.aval for v in eqn.invars]
        cplx = any(ff._kind(a) == "complex" for a in ins)
        if p == "custom_linear_solve":  # only the forward solve runs; the other jaxprs serve differentiation
            count_jaxpr(eqn.params["jaxprs"].solve.jaxpr, c, mult)
        elif p == "while":
            before = _snapshot(c)
            count_jaxpr(eqn.params["body_jaxpr"].jaxpr, c, mult)
            after = _snapshot(c)
            c["while_bodies"].append({k: after[k] - before[k] for k in KEYS})
            count_jaxpr(eqn.params["cond_jaxpr"].jaxpr, c, mult)
            c["flags"].add("while loop: body counted once (reported per iteration)")
        elif p == "cholesky":
            n = ins[0].shape[-1]
            c["linalg"] += mult * (ff._size(ins[0]) // (n * n)) * (4 if cplx else 1) * n ** 3 // 3
        elif p == "triangular_solve":
            a, b = ins[0], ins[1]
            m = a.shape[-1]
            k = b.shape[-1] if eqn.params.get("left_side", False) else b.shape[-2]
            c["linalg"] += mult * (ff._size(a) // (m * m)) * (4 if cplx else 1) * m * m * k
        elif p in ("lu", "eigh", "svd", "qr", "householder_product"):
            c["unknown"][p] += mult * ff._size(ins[0])
        else:
            _original(_One(eqn), c, mult)


ff.count_jaxpr = count_jaxpr  # the forward counter's recursion now goes through these rules too


def flops(c):
    return c["dot"] + c["conv"] + c["fft"] + c["elementwise"] + c["reduce"] + c.get("linalg", 0)


def summary(c):
    return {"flops": flops(c), **{k: c.get(k, 0) for k in KEYS}, "dot_macs_by_dtype": dict(c["dot_macs_by_dtype"]),
            "unknown_primitives": dict(c["unknown"]), "flags": sorted(c["flags"])}


def one(inst_id, name):
    import netket as nk
    g, hi, _, _ = build_instance(inst_id)
    model = build_model(name, g)
    m = MODELS[name]
    sampler = nk.sampler.MetropolisExchange(hi, graph=g, d_max=2, n_chains=PROTOCOL["n_chains"])
    vs = nk.vqs.MCState(sampler, model, n_samples=PROTOCOL["n_samples"], n_discard_per_chain=PROTOCOL["n_discard_per_chain"],
                        seed=PROTOCOL["seed"], sampler_seed=PROTOCOL["seed"] + 1, chunk_size=m["chunk"])
    vs.sample(n_discard_per_chain=0)
    dense = count_real_params(vs) <= PROTOCOL["n_samples"]
    solver = nk.optimizer.solver.cholesky if dense else functools.partial(jax.scipy.sparse.linalg.cg, maxiter=PROTOCOL["cg_maxiter"])
    sr = nk.optimizer.SR(qgt=nk.optimizer.qgt.QGTJacobianDense(chunk_size=m["chunk"]), solver=solver,
                         diag_shift=PROTOCOL["diag_shift"], diag_scale=PROTOCOL["diag_scale"])
    try:
        mode = nk.jax.jacobian_default_mode(vs._apply_fun, vs.parameters, vs.model_state, vs.samples.reshape(-1, g.n_nodes))
        mode = getattr(mode, "value", None) or str(mode)  # an enum in NetKet 3.22
    except Exception as e:  # noqa: BLE001
        mode = f"unknown ({repr(e)[:80]})"
    grad = jax.tree_util.tree_map(jnp.zeros_like, vs.parameters)
    jac = ff.new_count()
    count_jaxpr(jax.make_jaxpr(lambda: jax.tree_util.tree_leaves(sr.lhs_constructor(vs, 0)))().jaxpr, jac)
    step = ff.new_count()
    count_jaxpr(jax.make_jaxpr(lambda gr: sr(vs, gr, 0))(grad).jaxpr, step)
    solve = {k: step.get(k, 0) - jac.get(k, 0) for k in KEYS}
    rec = {
        "instance_id": inst_id, "model": name, "label": m["label"], "n_sites": g.n_nodes,
        "parameters": count_params(vs), "real_parameters": count_real_params(vs), "samples": PROTOCOL["n_samples"],
        "chunk_size": m["chunk"], "jacobian_mode": mode,
        "solver": "Cholesky on the dense S" if dense else f"conjugate gradients, {PROTOCOL['cg_maxiter']} iterations max",
        "jacobian": summary(jac),
        "step": summary(step),
        "solve_flops": sum(solve[k] for k in KEYS if k != "transcendentals"),
        "solve": solve,
    }
    if step["while_bodies"]:
        body = step["while_bodies"][-1]
        rec["cg_iteration_flops"] = sum(body[k] for k in KEYS if k != "transcendentals")
        rec["cg_iteration"] = body
        rec["solve_setup_flops"] = rec["solve_flops"] - rec["cg_iteration_flops"]
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", help="comma-separated instance:model pairs")
    args = ap.parse_args()
    out = {"schema": "qmbl-sr-flops-1", "script": "checks/cost/sr_flops.py",
           "script_sha256": hashlib.sha256(open(__file__, "rb").read()).hexdigest(),
           "forward_flops_sha256": hashlib.sha256(open(ff.__file__, "rb").read()).hexdigest(),
           "environment": ff.environment("cpu"), "protocol": {k: PROTOCOL[k] for k in ("n_samples", "n_chains", "diag_shift", "diag_scale", "cg_maxiter")},
           "runs": []}
    todo = [t for t in RUNS if not args.only or f"{t[0]}:{t[1]}" in args.only.split(",")]
    for inst_id, name in todo:
        t0 = time.perf_counter()
        try:
            rec = one(inst_id, name)
        except Exception as e:  # noqa: BLE001  (record and go on)
            rec = {"instance_id": inst_id, "model": name, "error": repr(e)[:800]}
        rec["seconds"] = round(time.perf_counter() - t0, 1)
        out["runs"].append(rec)
        print(f"{inst_id:28s} {name:8s} jac {rec.get('jacobian', {}).get('flops')} solve {rec.get('solve_flops')} "
              f"cg-iter {rec.get('cg_iteration_flops')} mode {rec.get('jacobian_mode')} {rec.get('error', '')} ({rec['seconds']} s)", flush=True)
    with open(args.out, "w") as f:
        json.dump(ff.finite(out), f, indent=1, allow_nan=False)
        f.write("\n")


if __name__ == "__main__":
    main()
