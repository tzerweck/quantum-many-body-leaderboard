#!/usr/bin/env python
"""Count the arithmetic of one forward pass of each network QMBL's cost runs train.

For every (instance, ansatz) that run_nqs.py builds, the network is built exactly as
run_nqs.py builds it, traced by JAX on a batch of configurations of the sampler's dtype, and
its floating-point operations are counted two ways:

- `flops_per_configuration`: from the traced program (the jaxpr), in the convention of
  DATA.md "How a FLOP count is estimated": a real multiply-add is 2 FLOPs, a multiply-add with
  one complex operand 4, with two complex operands 8; an elementwise operation 1 per element
  (a complex add 2, a complex multiply 6, a complex divide 11); a reduction 1 per element
  reduced. Transcendental functions (exp, log, tanh, sqrt, ...) are counted apart, once per
  element (twice, plus 4 FLOPs, for a complex argument), as XLA counts them; data movement
  (reshape, gather, convert) is not arithmetic and counts nothing.
- `xla`: XLA's own cost analysis of the lowered and of the compiled program, which is what
  arXiv:2606.02794 measured ("the built-in FLOP-counting utilities provided by JAX applied to
  the compiled computational graph"). `xla_convention` records how it counts a real and a
  complex multiply-add on this installation, so the two counts can be compared.

Per configuration is the difference between two batch sizes divided by their difference, so
work done once per call on the parameters alone is not charged to each configuration; a third
batch checks that the count is linear in the batch. Nothing is executed: a count is a property
of the program, not of the device, and needs no GPU. `--gpu-into` adds XLA's counts on a GPU
backend to a file written by a CPU pass.

    JAX_ENABLE_X64=1 JAX_PLATFORMS=cpu python forward_flops.py --out cpu.json
    JAX_ENABLE_X64=1 JAX_PLATFORMS=cuda python forward_flops.py --gpu-into cpu.json --out forward-flops.json
"""
import argparse
import hashlib
import json
import math
import platform
import socket
import sys
import time
import types
from collections import defaultdict

# run_nqs.py starts the protocol's resource monitor (a sampling thread) at import; a count needs none.
sys.modules["monitor"] = types.SimpleNamespace(Monitor=lambda: None)
from run_nqs import INSTANCES, MODELS, build_instance, build_model  # noqa: E402

import numpy as np  # noqa: E402
import jax  # noqa: E402

jax.config.update("jax_enable_x64", True)  # the runs set JAX_ENABLE_X64=1
import jax.numpy as jnp  # noqa: E402

BATCHES = (16, 1024)  # the two batches the per-configuration count is taken from
LINEARITY_BATCH = 256  # a third batch, traced only, to check the count is linear in the batch

# FLOPs per element: (real, complex).
ELEMENTWISE = {
    "add": (1, 2), "add_any": (1, 2), "sub": (1, 2), "neg": (1, 2), "mul": (1, 6), "div": (1, 11),
    "max": (1, 2), "min": (1, 2), "sign": (1, 3), "square": (1, 4), "rem": (1, 2), "select_n": (1, 2),
    "clamp": (2, 4), "floor": (1, 2), "ceil": (1, 2), "round": (1, 2), "nextafter": (1, 2),
    "is_finite": (1, 2), "copysign": (1, 2), "conj": (0, 1),
    "eq": (1, 2), "ne": (1, 2), "lt": (1, 2), "le": (1, 2), "gt": (1, 2), "ge": (1, 2),
}
TRANSCENDENTAL = {
    "exp", "exp2", "log", "log1p", "expm1", "tanh", "logistic", "sin", "cos", "tan", "asin", "acos",
    "atan", "atan2", "sinh", "cosh", "asinh", "acosh", "atanh", "sqrt", "rsqrt", "cbrt", "pow",
    "erf", "erfc", "erf_inv", "lgamma", "digamma",
}
REDUCE = {"reduce_sum": (1, 2), "reduce_max": (1, 2), "reduce_min": (1, 2), "reduce_prod": (1, 6)}
SCAN_LIKE = {"argmax": (1, 2), "argmin": (1, 2), "cumsum": (1, 2), "cumprod": (1, 6), "cummax": (1, 2), "cummin": (1, 2)}
DATA_MOVEMENT = {
    "reshape", "broadcast_in_dim", "transpose", "squeeze", "expand_dims", "concatenate", "pad", "slice",
    "dynamic_slice", "dynamic_update_slice", "gather", "scatter", "rev", "copy", "copy_p",
    "convert_element_type", "bitcast_convert_type", "iota", "real", "imag", "complex",
    "sharding_constraint", "split", "device_put", "reduce_precision", "stop_gradient", "optimization_barrier",
}


def _size(aval):
    return math.prod(getattr(aval, "shape", ()))


def _kind(aval):
    try:
        dt = np.dtype(aval.dtype)
    except TypeError:  # PRNG keys and other extended dtypes
        return "other"
    return "complex" if np.issubdtype(dt, np.complexfloating) else "float" if np.issubdtype(dt, np.floating) else "other"


def _jaxprs(v):
    """The jaxprs held by an equation parameter (a Jaxpr, a ClosedJaxpr, or a tuple of them)."""
    if hasattr(v, "eqns"):
        yield v
    elif hasattr(v, "jaxpr") and hasattr(v.jaxpr, "eqns"):
        yield v.jaxpr
    elif isinstance(v, (tuple, list)):
        for x in v:
            yield from _jaxprs(x)


def new_count():
    return dict(dot=0, conv=0, fft=0, elementwise=0, reduce=0, transcendentals=0,
                dot_macs_by_dtype=defaultdict(int), unknown=defaultdict(int), flags=set())


def total(c):
    return c["dot"] + c["conv"] + c["fft"] + c["elementwise"] + c["reduce"]


def count_jaxpr(jaxpr, c, mult=1):
    """Add the floating-point work of `jaxpr`, executed `mult` times, to the count `c`."""
    for eqn in jaxpr.eqns:
        p = eqn.primitive.name
        ins = [v.aval for v in eqn.invars]
        outs = [v.aval for v in eqn.outvars]
        kinds = {_kind(a) for a in ins + outs}
        cplx = "complex" in kinds
        if p == "dot_general":
            (lc, _), _ = eqn.params["dimension_numbers"]
            macs = _size(outs[0]) * math.prod(ins[0].shape[d] for d in lc)
            nc = sum(_kind(a) == "complex" for a in ins[:2])
            c["dot"] += mult * macs * (2, 4, 8)[nc]
            c["dot_macs_by_dtype"][f"{ins[0].dtype} x {ins[1].dtype}"] += mult * macs
        elif p == "conv_general_dilated":
            rhs, spec = ins[1], eqn.params["dimension_numbers"].rhs_spec  # (out feature, in feature, spatial...)
            macs = _size(outs[0]) * rhs.shape[spec[1]] * math.prod(rhs.shape[d] for d in spec[2:])
            nc = sum(_kind(a) == "complex" for a in ins[:2])
            c["conv"] += mult * macs * (2, 4, 8)[nc]
            c["dot_macs_by_dtype"][f"conv {ins[0].dtype} x {ins[1].dtype}"] += mult * macs
        elif p == "fft":
            n = math.prod(eqn.params["fft_lengths"])
            transforms = _size(ins[0]) // max(1, math.prod(ins[0].shape[-len(eqn.params["fft_lengths"]):]))
            real = "RFFT" in str(eqn.params["fft_type"]).upper()  # RFFT and IRFFT: half a complex transform
            c["fft"] += mult * transforms * int((2.5 if real else 5) * n * math.log2(max(n, 2)))
        elif p == "scan":
            count_jaxpr(eqn.params["jaxpr"].jaxpr, c, mult * eqn.params["length"])
        elif p == "while":
            c["flags"].add("while loop: body counted once, trip count unknown")
            count_jaxpr(eqn.params["body_jaxpr"].jaxpr, c, mult)
            count_jaxpr(eqn.params["cond_jaxpr"].jaxpr, c, mult)
        elif p == "cond":
            branch_counts = []
            for b in eqn.params["branches"]:
                bc = new_count()
                count_jaxpr(b.jaxpr, bc, mult)
                branch_counts.append(bc)
            worst = max(branch_counts, key=lambda x: (total(x), x["transcendentals"]))
            for k in ("dot", "conv", "fft", "elementwise", "reduce", "transcendentals"):
                c[k] += worst[k]
            for k, v in worst["dot_macs_by_dtype"].items():
                c["dot_macs_by_dtype"][k] += v
            for k, v in worst["unknown"].items():
                c["unknown"][k] += v
            c["flags"] |= worst["flags"] | {"cond: the costlier branch counted"}
        elif p in ELEMENTWISE:
            if kinds & {"float", "complex"}:
                c["elementwise"] += mult * _size(outs[0]) * ELEMENTWISE[p][1 if cplx else 0]
        elif p == "integer_pow" and kinds & {"float", "complex"}:
            y = eqn.params["y"]
            per = (6 if cplx else 1) * max(abs(y) - 1, 0) + ((11 if cplx else 1) if y < 0 else 0)
            c["elementwise"] += mult * _size(outs[0]) * per
        elif p == "abs":
            if cplx:  # sqrt(re^2 + im^2)
                c["elementwise"] += mult * _size(outs[0]) * 3
                c["transcendentals"] += mult * _size(outs[0])
            elif kinds & {"float"}:
                c["elementwise"] += mult * _size(outs[0])
        elif p in TRANSCENDENTAL:
            n = _size(outs[0])
            c["transcendentals"] += mult * n * (2 if cplx else 1)
            if cplx:
                c["elementwise"] += mult * n * 4
        elif p in REDUCE:
            if kinds & {"float", "complex"}:
                c["reduce"] += mult * (_size(ins[0]) - _size(outs[0])) * REDUCE[p][1 if cplx else 0]
        elif p == "reduce":  # a variadic reduction with its own reducer: one operation per element reduced
            c["flags"].add("generic reduce counted as one operation per element")
            c["reduce"] += mult * (_size(ins[0]) - _size(outs[0]))
        elif p in SCAN_LIKE:
            if kinds & {"float", "complex"}:
                c["reduce"] += mult * _size(ins[0]) * SCAN_LIKE[p][1 if cplx else 0]
        elif p in ("scatter-add", "scatter_add"):
            c["elementwise"] += mult * _size(ins[2]) * (2 if cplx else 1)
        elif p in DATA_MOVEMENT:
            pass
        else:
            inner = [j for v in eqn.params.values() for j in _jaxprs(v)]
            if inner:  # pjit, custom_jvp_call, custom_vjp_call, remat, closed_call, ...
                for j in inner:
                    count_jaxpr(j, c, mult)
            elif kinds & {"float", "complex"}:
                c["unknown"][p] += mult * max(_size(a) for a in outs) if outs else 0


def count_fn(f, *args):
    c = new_count()
    count_jaxpr(jax.make_jaxpr(f)(*args).jaxpr, c)
    return c


def xla_costs(stage):
    """XLA's cost analysis of a jax.stages.Lowered or Compiled, as plain numbers."""
    try:
        ca = stage.cost_analysis()
    except Exception as e:  # noqa: BLE001  (a backend without cost analysis)
        return {"error": repr(e)[:200]}
    if isinstance(ca, (list, tuple)):
        ca = ca[0] if ca else {}
    ca = ca or {}
    get = lambda k: float(ca[k]) if k in ca and ca[k] is not None else None  # noqa: E731
    return {"flops": get("flops"), "transcendentals": get("transcendentals"), "bytes_accessed": get("bytes accessed")}


def per_config(lo, hi, b_lo, b_hi):
    """Per-configuration slope and per-call intercept of a count taken at two batch sizes."""
    out = {}
    for k in ("flops", "transcendentals", "bytes_accessed"):
        a, b = lo.get(k), hi.get(k)
        if a is None or b is None:
            out[k] = None
            continue
        slope = (b - a) / (b_hi - b_lo)
        out[f"{k}_per_configuration"] = slope
        out[f"{k}_per_call"] = a - slope * b_lo
    return {k: v for k, v in out.items() if v is not None}


def xla_convention(compile_it):
    """How this XLA counts a multiply-add and a multiply, real and complex (per MAC / element)."""
    A, B = jnp.ones((64, 128)), jnp.ones((128, 32))
    macs = 64 * 128 * 32
    fl = lambda d: d["flops"] if d.get("flops") is not None else float("nan")  # noqa: E731
    res = {}
    for tag, dt in (("real", jnp.float64), ("complex", jnp.complex128)):
        a, b = A.astype(dt), B.astype(dt)
        lowered = jax.jit(jnp.dot).lower(a, b)
        res[f"dot_{tag}_flops_per_mac_lowered"] = fl(xla_costs(lowered)) / macs
        if compile_it:
            res[f"dot_{tag}_flops_per_mac_compiled"] = fl(xla_costs(lowered.compile())) / macs
        res[f"dot_{tag}_flops_per_mac_counted"] = total(count_fn(jnp.dot, a, b)) / macs
        lowered = jax.jit(jnp.multiply).lower(a, a)
        res[f"mul_{tag}_flops_per_element_lowered"] = fl(xla_costs(lowered)) / a.size
        res[f"mul_{tag}_flops_per_element_counted"] = total(count_fn(jnp.multiply, a, a)) / a.size
    return res


def environment(tag):
    import flax
    import netket as nk
    try:
        from jaxlib import version as jaxlib_version
        jaxlib = jaxlib_version.__version__
    except Exception:  # noqa: BLE001
        jaxlib = None
    dev = jax.devices()[0]
    return {
        "backend": jax.default_backend(), "device_kind": dev.device_kind, "host": socket.gethostname(),
        "python": platform.python_version(), "netket": nk.__version__, "jax": jax.__version__,
        "jaxlib": jaxlib, "flax": flax.__version__, "pass": tag,
        "ran_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def build(inst_id, name):
    import netket as nk
    g, hi, _, n_conn = build_instance(inst_id)
    dtype = nk.sampler.MetropolisExchange(hi, graph=g, d_max=2, n_chains=16).dtype  # what run_nqs.py's sampler feeds the network
    model = build_model(name, g)
    variables = model.init(jax.random.PRNGKey(0), jnp.ones((1, g.n_nodes), dtype=dtype))
    apply = lambda v, s: model.apply(v, s)  # noqa: E731
    batch = lambda n: jnp.ones((n, g.n_nodes), dtype=dtype)  # noqa: E731  (values do not enter a count)
    return g, n_conn, dtype, variables, apply, batch


def cpu_pass(args):
    out = {"schema": "qmbl-forward-flops-1", "script": "checks/cost/forward_flops.py",
           "script_sha256": hashlib.sha256(open(__file__, "rb").read()).hexdigest(),
           "batches": list(BATCHES), "linearity_batch": LINEARITY_BATCH,
           "environment": {"cpu": environment("cpu")}, "xla_convention": {"cpu": xla_convention(True)},
           "configurations": []}
    todo = [(i, m) for i in sorted(INSTANCES) for m in sorted(MODELS)]
    if args.only:
        todo = [t for t in todo if f"{t[0]}:{t[1]}" in args.only.split(",")]
    for inst_id, name in todo:
        t0 = time.perf_counter()
        rec = {"instance_id": inst_id, "model": name, "label": MODELS[name]["label"]}
        try:
            g, n_conn, dtype, variables, apply, batch = build(inst_id, name)
            leaves = jax.tree_util.tree_leaves(variables["params"])
            rec.update(n_sites=g.n_nodes, n_conn=n_conn, input_dtype=str(np.dtype(dtype)),
                       parameters=int(sum(x.size for x in leaves)),
                       real_parameters=int(sum(x.size * (2 if jnp.iscomplexobj(x) else 1) for x in leaves)),
                       parameter_dtypes=sorted({str(x.dtype) for x in leaves}))
            counts, xl, xc = {}, {}, {}
            for n in (*BATCHES, LINEARITY_BATCH):
                counts[n] = count_fn(apply, variables, batch(n))
            for n in BATCHES:
                lowered = jax.jit(apply).lower(variables, batch(n))
                xl[n], xc[n] = xla_costs(lowered), xla_costs(lowered.compile())
            lo, hi = BATCHES
            slope = lambda k: (counts[hi][k] - counts[lo][k]) / (hi - lo)  # noqa: E731
            f_lo, f_hi, f_mid = (total(counts[n]) for n in (lo, hi, LINEARITY_BATCH))
            fpc = (f_hi - f_lo) / (hi - lo)
            rec.update(
                flops_per_configuration=fpc,
                flops_per_call=f_lo - fpc * lo,
                transcendentals_per_configuration=slope("transcendentals"),
                by_kind_per_configuration={k: slope(k) for k in ("dot", "conv", "fft", "elementwise", "reduce")},
                dot_macs_by_dtype_per_configuration={k: (counts[hi]["dot_macs_by_dtype"][k] - counts[lo]["dot_macs_by_dtype"].get(k, 0)) / (hi - lo)
                                                     for k in counts[hi]["dot_macs_by_dtype"]},
                linear_in_batch=abs(f_mid - (f_lo + fpc * (LINEARITY_BATCH - lo))) <= 1e-9 * max(1, f_mid),
                unknown_primitives={k: v for k, v in counts[hi]["unknown"].items()},
                flags=sorted(counts[hi]["flags"]),
                xla={"lowered_cpu": per_config(xl[lo], xl[hi], lo, hi), "compiled_cpu": per_config(xc[lo], xc[hi], lo, hi)},
            )
        except Exception as e:  # noqa: BLE001  (record and go on: one failing network must not lose the others)
            rec["error"] = repr(e)[:500]
        rec["seconds"] = round(time.perf_counter() - t0, 1)
        out["configurations"].append(rec)
        print(f"{inst_id:28s} {name:8s} {rec.get('flops_per_configuration', rec.get('error'))} ({rec['seconds']} s)", flush=True)
    return out


def gpu_pass(args):
    out = json.load(open(args.gpu_into))
    out["environment"]["gpu"] = environment("gpu")
    out["xla_convention"]["gpu"] = xla_convention(True)
    lo, hi = out["batches"]
    for rec in out["configurations"]:
        if "error" in rec:
            continue
        t0 = time.perf_counter()
        try:
            _, _, _, variables, apply, batch = build(rec["instance_id"], rec["model"])
            xl, xc = {}, {}
            for n in (lo, hi):
                lowered = jax.jit(apply).lower(variables, batch(n))
                xl[n], xc[n] = xla_costs(lowered), xla_costs(lowered.compile())
            rec["xla"]["lowered_gpu"] = per_config(xl[lo], xl[hi], lo, hi)
            rec["xla"]["compiled_gpu"] = per_config(xc[lo], xc[hi], lo, hi)
        except Exception as e:  # noqa: BLE001
            rec["xla"]["gpu_error"] = repr(e)[:500]
        print(f"{rec['instance_id']:28s} {rec['model']:8s} gpu {rec['xla'].get('compiled_gpu', rec['xla'].get('gpu_error'))} "
              f"({time.perf_counter() - t0:.1f} s)", flush=True)
    return out


def finite(x):
    """NaN and infinity are not JSON: a missing count is null."""
    if isinstance(x, float):
        return x if math.isfinite(x) else None
    if isinstance(x, dict):
        return {k: finite(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [finite(v) for v in x]
    return x


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", help="comma-separated instance:model pairs")
    ap.add_argument("--gpu-into", help="a CPU pass's output to add XLA's GPU counts to")
    args = ap.parse_args()
    out = gpu_pass(args) if args.gpu_into else cpu_pass(args)
    with open(args.out, "w") as f:
        json.dump(finite(out), f, indent=1, allow_nan=False)
        f.write("\n")


if __name__ == "__main__":
    main()
