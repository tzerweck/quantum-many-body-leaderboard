"""Settle whether VarBench's TFIsing 'RBM (alpha = 1)' rows are a bad energy or a bad error bar.

Three rows sit BELOW an exact solution, which no variational ansatz can do:
  TFIsing/chain_10_P_1  RBM -12.785231(48)  vs exact -12.784906442999322   (6.8 sigma)
  TFIsing/chain_10_O_1  RBM -12.381718(22)  vs exact -12.381489999654734   (10.4 sigma)

VarBench convention (TFIsing/README.md), Pauli matrices, J = 1:
    H = J sum_<ij> sz_i sz_j + Gamma sum_i sx_i

At N = 10 the Hilbert space is 1024, so we can do better than resampling: after
training we evaluate the SAME parameters by full summation, which gives the RBM's
true variational energy with zero Monte-Carlo error. The variational principle then
gives a hard answer rather than a statistical one.
"""
import json, sys, time
import numpy as np
import netket as nk

N, GAMMA = 10, 1.0
N_SAMPLES_TRAIN, N_ITER = 4096, 2000
N_SAMPLES_MEASURE = 2 ** 19
SEEDS = [0, 1, 2]


def build(pbc):
    g = nk.graph.Chain(length=N, pbc=pbc)
    hi = nk.hilbert.Spin(s=1 / 2, N=g.n_nodes)
    sz, sx = nk.operator.spin.sigmaz, nk.operator.spin.sigmax
    H = sum(sz(hi, i) @ sz(hi, j) for i, j in g.edges())
    H = H + GAMMA * sum(sx(hi, i) for i in range(g.n_nodes))
    return g, hi, H


def run(bc_label, pbc, varbench_exact, varbench_rbm, varbench_sigma):
    g, hi, H = build(pbc)
    e0 = float(nk.exact.lanczos_ed(H, compute_eigenvectors=False)[0])
    out = {
        "instance": f"TFIsing/chain_{N}_{bc_label}_{GAMMA:g}",
        "our_ed": e0,
        "varbench_exact": varbench_exact,
        "ed_agrees_with_varbench": abs(e0 - varbench_exact) < 1e-9,
        "varbench_rbm": varbench_rbm, "varbench_sigma": varbench_sigma,
        "seeds": [],
    }
    print(f"\n=== {out['instance']} ===", flush=True)
    print(f"  our ED        {e0:.15f}", flush=True)
    print(f"  VarBench exact{varbench_exact:.15f}   agree={out['ed_agrees_with_varbench']}", flush=True)

    for seed in SEEDS:
        t0 = time.time()
        model = nk.models.RBM(alpha=1, param_dtype=complex)
        sa = nk.sampler.MetropolisLocal(hi, n_chains=16)
        vs = nk.vqs.MCState(sa, model, n_samples=N_SAMPLES_TRAIN, seed=seed, sampler_seed=seed + 100)
        gs = nk.driver.VMC(H, nk.optimizer.Sgd(learning_rate=0.05), variational_state=vs,
                           preconditioner=nk.optimizer.SR(diag_shift=0.01, holomorphic=True))
        trace = []
        gs.run(n_iter=N_ITER, show_progress=False,
               callback=lambda step, log, d: (trace.append(float(np.real(d.energy.mean))), True)[1])

        # 1. honest MC measurement of the trained state
        vs.n_samples = N_SAMPLES_MEASURE
        st = vs.expect(H)
        # 2. the same parameters, summed exactly over all 1024 basis states
        fs = nk.vqs.FullSumState(hi, model, seed=seed)
        fs.parameters = vs.parameters
        e_full = float(np.real(fs.expect(H).mean))

        r = {
            "seed": seed,
            "mc_energy": float(np.real(st.mean)), "mc_sigma": float(st.error_of_mean),
            "mc_variance": float(st.variance),
            "tau_corr": float(getattr(st, "tau_corr", float("nan"))),
            "r_hat": float(getattr(st, "R_hat", float("nan"))),
            "fullsum_energy": e_full,
            "fullsum_above_ed": e_full - e0,
            "trace_min": float(min(trace)),
            "trace_min_minus_ed": min(trace) - e0,
            "trace_last50_mean": float(np.mean(trace[-50:])),
            "seconds": round(time.time() - t0, 1),
        }
        out["seeds"].append(r)
        print(f"  seed {seed}: fullsum {e_full:.9f} (ED+{r['fullsum_above_ed']:.2e})"
              f"  MC {r['mc_energy']:.6f}+/-{r['mc_sigma']:.1e} tau={r['tau_corr']:.2f} Rhat={r['r_hat']:.4f}"
              f"  trace_min {r['trace_min']:.6f} (ED{r['trace_min_minus_ed']:+.2e})  {r['seconds']}s", flush=True)
    return out


if __name__ == "__main__":
    res = [
        run("P", True, -12.784906442999322, -12.785231, 0.000048),
        run("O", False, -12.381489999654734, -12.381718, 0.000022),
    ]
    with open("results-tfising-rbm.json", "w") as f:
        json.dump({"netket": nk.__version__, "n_iter": N_ITER,
                   "n_samples_train": N_SAMPLES_TRAIN, "n_samples_measure": N_SAMPLES_MEASURE,
                   "results": res}, f, indent=2)
    print("\nwrote results-tfising-rbm.json", flush=True)
