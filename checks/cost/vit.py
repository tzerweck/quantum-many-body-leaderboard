"""A vision-transformer wave function with factored attention, QMBL's own implementation
of the architecture of Viteritti, Rende & Becca (PRL 130, 236401, 2023) and Rende &
Viteritti (arXiv:2405.18874): an L x L spin configuration is cut into b x b patches, each
linearly embedded in R^d; n_l pre-LayerNorm encoder layers whose attention weights are
learned parameters of the relative patch displacement (no queries or keys) and whose MLP
has a 4d hidden layer; the token sum z in R^d; and a complex hidden layer,
log psi = sum_k log cosh(W z + c)_k with complex W and c.

Not the authors' code, and no symmetrisation: a row produced with it says so.
"""
import flax.linen as nn
import jax
import jax.numpy as jnp
import netket as nk
import numpy as np


class FactoredAttention(nn.Module):
    n_x: int
    n_y: int
    heads: int
    d: int

    @nn.compact
    def __call__(self, x):  # x: (..., n, d)
        n = self.n_x * self.n_y
        # Relative displacement of token i from token j on the periodic patch grid.
        xs, ys = np.divmod(np.arange(n), self.n_y)
        rel = ((xs[:, None] - xs[None, :]) % self.n_x) * self.n_y + (ys[:, None] - ys[None, :]) % self.n_y
        table = self.param("alpha", nn.initializers.normal(0.1), (self.heads, n))
        A = table[:, rel]  # (heads, n, n)
        dh = self.d // self.heads
        v = nn.Dense(self.d, use_bias=False, name="value")(x)
        v = v.reshape(v.shape[:-1] + (self.heads, dh))  # (..., n, heads, dh)
        out = jnp.einsum("hij,...jhd->...ihd", A, v).reshape(v.shape[:-2] + (self.d,))
        return nn.Dense(self.d, use_bias=False, name="out")(out)


class EncoderLayer(nn.Module):
    n_x: int
    n_y: int
    heads: int
    d: int

    @nn.compact
    def __call__(self, x):
        x = x + FactoredAttention(self.n_x, self.n_y, self.heads, self.d)(nn.LayerNorm()(x))
        h = nn.LayerNorm()(x)
        h = nn.Dense(4 * self.d)(h)
        h = nn.gelu(h)
        h = nn.Dense(self.d)(h)
        return x + h


class ViT(nn.Module):
    L: int
    patch: int = 2
    d: int = 60
    heads: int = 10
    layers: int = 4

    @nn.compact
    def __call__(self, sigma):  # sigma: (..., L*L) in {-1, +1}
        b, L = self.patch, self.L
        n_x = n_y = L // b
        lead = sigma.shape[:-1]
        x = sigma.reshape(lead + (n_x, b, n_y, b)).transpose(*range(len(lead)), len(lead), len(lead) + 2, len(lead) + 1, len(lead) + 3)
        x = x.reshape(lead + (n_x * n_y, b * b)).astype(jnp.float64)
        x = nn.Dense(self.d, name="embed")(x)
        x = x + self.param("pos", nn.initializers.normal(0.02), (n_x * n_y, self.d))
        for i in range(self.layers):
            x = EncoderLayer(n_x, n_y, self.heads, self.d, name=f"layer{i}")(x)
        z = nn.LayerNorm(name="final_norm")(x).sum(axis=-2)  # (..., d)
        W = self.param("w_out", nn.initializers.normal(0.05, dtype=jnp.complex128), (self.d, self.d))
        c = self.param("c_out", nn.initializers.zeros, (self.d,), jnp.complex128)
        return nk.nn.log_cosh(z.astype(jnp.complex128) @ W + c).sum(axis=-1)
