# Checks

Reruns that settle a specific claim about a row. Each one exists because
`scripts/validate.mjs` flagged something that could not be resolved by reading.

## `tfim_obc_ed.mjs`: is arXiv:2605.13807's variational column below its own exact column?

**Question.** The first TFIsing candidate the sweep ever produced came from
arXiv:2605.13807 (parallel-scan recurrent NQS), whose transverse-field Ising chain table
reports a `1D LRU` variational energy and an `e exact (N)` reference at each size. At
N = 10, 24 and 32 the variational value sits *below* the exact one; at N = 6, 8, 12, 16,
48, 64 and 96 it sits correctly above. Is that a real inversion, or did the harvester
misread the columns? A fair suspicion, since a column-shift bug had just been fixed.

**Design.** Matrix-free Lanczos ground state of `H = -sum s^z s^z - h sum s^x` on an OPEN
chain at h = 1, for N = 6…16, in the Pauli convention. Independent of the harvester and of
VarBench. If our ED reproduces the paper's `e exact (N)` column, the columns are assigned
correctly and the inversion is in the data.

**Result.** ED reproduces the paper's exact column at all five sizes to seven decimals.
The cells also came through the HTML path, which has real cell boundaries rather than the
PDF position heuristic. So the column assignment is right and the inversion is real:
−1.2381549 against an exact −1.2381490 at N = 10, about 8σ on the paper's own error bar.

The same ED reproduces `TFIsing/chain_10_O_1`'s stored exact row to seven digits, which
independently confirms the instance, the open boundary and the corrected E/N convention.

**Note.** This is the *second* source reporting a sub-exact variational energy on this one
10-site instance: VarBench's own `RBM (alpha = 1)` row is 2.3e-5 below exact, resolved
below as an optimization-trace minimum rather than a converged measurement. Two unrelated
groups making the same class of error on the same tiny instance is a pattern, not a
coincidence, and it is an argument for reporting converged energies with their variance.

**Reproduce.** `node checks/tfim_obc_ed.mjs` (seconds, no GPU).

## `tfising_rbm_check.py`: the three `RBM (alpha = 1)` rows below exact

**Question.** VarBench's TFIsing `RBM (alpha = 1)` rows sit below the exact ground state
by 3.8 to 10.4 sigma. Is the energy wrong, or is the error bar wrong?

**Design.** At N = 10 the Hilbert space is 1024, so the trained parameters can be evaluated
by *full summation*: the RBM's true variational energy with zero Monte-Carlo error. The
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
measurements: each lies between our converged energy and our trace minimum. The
autocorrelation hypothesis is ruled out. Our ED reproduces both VarBench exact values to 1e-14,
so the reference is sound and only the RBM rows are at fault.

**Reproduce.**

```bash
CUDA_VISIBLE_DEVICES="" JAX_PLATFORMS=cpu python tfising_rbm_check.py   # ~45 min, CPU, 16 cores
```

## `hubbard-u-labels/`: which U were the 4x4 and 14-site chain Hubbard rows computed at?

**Question.** Four VarBench exact diagonalizations on 4x4 Hubbard instances sat *below* the
ground state of the Hamiltonian their instance names (U = 3.5981 and 7.74264, 8 and 10
electrons), which no eigenvalue can. Is the energy wrong, or the name?

**Design.** Lanczos ground state over the full fixed-(N_up, N_dn) space, no symmetry, t = 1,
`H = -sum (c+c + h.c.) + U sum n_up n_dn` on the periodic 4x4 lattice (32 bonds) and the
periodic 14-site chain, at the U in each instance name and at the grid value
10^(k/9) it rounds. Two independent codes: `ed_check.py` (numpy/scipy) and `ed_lib.mjs` with
`run_fermions.mjs` (node), plus `skeptic_ed.py` for the 5+5, U = 2.1544 case. Self-tests at
U = 0 reproduce free fermions, and `skeptic_ed.py` reproduces the paper's U = 10 value.

**Result.** Every stored exact energy is the ground state at the grid U, to 1e-10 or better
(`ed_results_hypothesis.jsonl`, `logs_fermions_altU.log`); at the named U it is off by up to
3.4e-3. The HFDS rows of Robledo Moreno et al. (PNAS 119, e2122059119), whose supplement
prints the same exact energies at "U = 2.15, 3.6, 7.75", are at the grid U too. The DMRG run
scripts set the named U, and each DMRG energy sits just above the ground state at that U
(`ed_results.jsonl`, `logs_fermions_small.log`, `logs_fermions_16_5.log`).

**Conclusion.** The names are wrong, not the energies. `scripts/relabels.mjs` moves the six
instances to the grid U and keeps the DMRG rows, with the ground state at their own U as the
exact row, on the old names where the two ground states differ by more than the DMRG rows
resolve.

**Reproduce.**

```bash
node run_fermions.mjs Hubbard/square_16_P_5_2.1544 Hubbard/square_16_P_5_2.1544@2.15443469   # ~4 min each, ~1 GB
python ed_check.py '[{"lattice":"square","L":4,"n":5,"U":2.15443469}]' out.jsonl
```
