#!/usr/bin/env python3
# Evaluate the parameters vmc.py left in out/.../out.mpack: full summation where the
# Hilbert space allows it (N <= 20), the exact ground state by ED (N <= 20) or the
# free-fermion formula (TFIM chains), and repeated MC estimates with the script's own
# estimator to see whether the sampled energy scatters around the full-summation value.
import json
import os

import jax
import netket as nk
import numpy as np
from flax import serialization

from args import args
from vmc import get_ham, get_net, get_sampler, get_vstate

graph, hilbert, H = get_ham()
model = get_net(graph, hilbert)
sampler = get_sampler(graph, hilbert)
vstate = get_vstate(sampler, model)
with open(args.log_filename + ".mpack", "rb") as f:
    vstate.variables = serialization.from_bytes(vstate.variables, f.read())
N = hilbert.size
out = {"instance": args.ham_name, "N": N}

# exact ground state
if N <= 20:
    out["exact_ed"] = float(nk.exact.lanczos_ed(H, k=1)[0])
if args.ham == "ising" and args.ham_dim == 1 and args.boundary == "peri":
    # H = -sum sz sz - h sum sx (Pauli). Free fermions, even-parity sector, antiperiodic k:
    # E0 = -1/2 sum_k eps_k over all N momenta, eps_k = 2 sqrt(1 + h^2 - 2 h cos k). Checked
    # against the ED value above for N = 10.
    h = args.h
    ks = np.pi * (2 * np.arange(N) + 1) / N
    eps = 2 * np.sqrt(1 + h * h - 2 * h * np.cos(ks))
    out["exact_freefermion"] = float(-0.5 * eps.sum())
# full summation of the stored parameters
if N <= 20:
    fs = nk.vqs.FullSumState(hilbert, model)
    fs.variables = vstate.variables
    e = fs.expect(H)
    out["fullsum"] = {"mean": float(np.real(e.mean)), "variance": float(np.real(e.variance))}
# the script's own estimator, repeated
reps = []
for r in range(int(os.environ.get("EVAL_REPS", "5"))):
    vstate.n_samples = args.estim_size
    vstate.reset()
    e = vstate.expect(H)
    reps.append({"mean": float(np.real(e.mean)), "error_of_mean": float(np.real(e.error_of_mean)),
                 "variance": float(np.real(e.variance)), "tau_corr": float(np.real(e.tau_corr)), "R_hat": float(np.real(e.R_hat))})
out["mc_estimates"] = reps
print(json.dumps(out, indent=1))
with open(args.log_filename + ".eval.json", "w") as f:
    json.dump(out, f, indent=1)
