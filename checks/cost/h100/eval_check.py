"""One-off check of run_nqs.py's batched final evaluation (README, amendment v1.5), run on the
H100 host: (1) on 4 x 4, NetKet's statistics of the local-estimator array equal vs.expect on the
same samples, so the orientation the batching relies on is NetKet's own; (2) the joined batches
of one set of samples give the same statistics as one call on them."""
import numpy as np
import jax.numpy as jnp
import netket as nk

g = nk.graph.Square(4, pbc=True, max_neighbor_order=2)
hi = nk.hilbert.Spin(s=1 / 2, N=g.n_nodes, total_sz=0)
H = nk.operator.Heisenberg(hi, g, J=[1.0, 0.5], sign_rule=[True, False])
sa = nk.sampler.MetropolisExchange(hi, graph=g, d_max=2, n_chains=64)
vs = nk.vqs.MCState(sa, nk.models.RBM(alpha=1, param_dtype=complex), n_samples=64 * 32, seed=1, sampler_seed=2)
vs.sample()
E1 = vs.expect(H)
loc = jnp.asarray(vs.local_estimators(H))  # a LocalEstimators object in NetKet 3.22
E2 = nk.stats.statistics(loc)
print("local_estimators shape", loc.shape, "samples shape", vs.samples.shape)
print("expect    ", E1.mean, E1.error_of_mean, E1.R_hat, E1.tau_corr)
print("statistics", E2.mean, E2.error_of_mean, E2.R_hat, E2.tau_corr)
assert np.allclose(E1.mean, E2.mean) and np.isclose(E1.error_of_mean, E2.error_of_mean) and np.isclose(E1.R_hat, E2.R_hat)
axis = 1 if loc.shape[0] == 64 else 0
halves = jnp.split(loc, 2, axis=axis)
E3 = nk.stats.statistics(jnp.concatenate(halves, axis=axis))
assert np.allclose(E3.mean, E2.mean) and np.isclose(E3.error_of_mean, E2.error_of_mean) and np.isclose(E3.R_hat, E2.R_hat)
print("chain axis", 0 if axis == 1 else 1, "- batched statistics equal one call: OK")
