# Checks

Reruns that settle a specific claim about a row. Each one exists because
`scripts/validate.mjs` flagged something that could not be resolved by reading.

## `tfising_rbm_check.py` — the three `RBM (alpha = 1)` rows below exact

**Question.** VarBench's TFIsing `RBM (alpha = 1)` rows sit below the exact ground state
by 3.8 to 10.4 sigma. Is the energy wrong, or is the error bar wrong?

**Design.** At N = 10 the Hilbert space is 1024, so the trained parameters can be evaluated
by *full summation* — the RBM's true variational energy with zero Monte-Carlo error. The
variational principle then gives a hard answer instead of a statistical one. Three seeds per
instance; the training trace is kept so its minimum can be compared against the published value.

**Result** (`results-tfising-rbm.json`, spiritbox, netket 3.22.4, 2026-09-11).

| | chain_10_P_1 | chain_10_O_1 |
|---|---|---|
| our ED | −12.784906442999315 | −12.381489999654761 |
| VarBench exact | −12.784906442999322 | −12.381489999654734 |
| VarBench RBM row | −12.785231 (6.8σ below) | −12.381718 (10.4σ below) |
| our converged RBM, full summation | −12.78412 … −12.78458 (**above** ED) | −12.38099 … −12.38138 (**above** ED) |
| our training-trace minima | −12.78785 … −12.78835 (**below** ED) | −12.38299 … −12.38433 (**below** ED) |
| tau_corr / R_hat | ≤ 0.05 / 1.0000 | ≤ 0.05 / 1.0000 |

**Conclusion.** The published values are minima of the optimization trace, not converged
measurements — each lies between our converged energy and our trace minimum. The
autocorrelation hypothesis is ruled out. Our ED reproduces both VarBench exact values to 1e-14,
so the reference is sound and only the RBM rows are at fault.

**Reproduce.**

```bash
CUDA_VISIBLE_DEVICES="" JAX_PLATFORMS=cpu python tfising_rbm_check.py   # ~45 min, CPU, 16 cores
```
