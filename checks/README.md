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
below (first read as an optimization-trace minimum; withdrawn 2026-09-21, see the next two sections). Two unrelated
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

**Conclusion at the time.** The published values are minima of the optimization trace, not
converged measurements: each lies between our converged energy and our trace minimum. The
autocorrelation hypothesis is ruled out. Our ED reproduces both VarBench exact values to 1e-14,
so the reference is sound and only the RBM rows are at fault.

**Withdrawn 2026-09-21.** This check ran a different program from the one the rows link (a
complex RBM in netket 3.22, 2000 steps). The rerun below of the linked program itself, plus
VarBench's upload history, shows the stored numbers are final 2^20-sample estimates (their
bars equal sqrt(variance / 2^20)), entered in 2023 without code, and that the linked program
cannot produce them. The flag stands; the "trace minimum" mechanism does not.

**Reproduce.**

```bash
CUDA_VISIBLE_DEVICES="" JAX_PLATFORMS=cpu python tfising_rbm_check.py   # ~45 min, CPU, 16 cores
```

## `tfising-rbm-varbench-rerun/`: the linked VarBench program, run as pinned

**Question.** Does the program the three `RBM (alpha = 1)` rows cite
(varbench/methods `programs/vmc_netket`, commit ed31bb0) produce the stored numbers, and can
it produce a value below the exact energy at all?

**Design.** `run.sh` builds the pinned environment (`requirements.txt`: NetKet 3.13.0,
jax 0.4.30; Python 3.11 because the pinned etils needs it despite the README's 3.10) and runs
the three `vmc_rbm.sh` command lines unchanged (real float32 RBM alpha = 1, SR, 10^4 steps,
1024 chains, seed 123, final estimate with 2^20 samples) on CPU. `eval_final.py` then loads
the final parameters and computes the exact ground state (ED at N = 10, free fermions at
N = 32), the full-summation energy of the same parameters (N = 10), and five repeated
2^20-sample estimates with tau_corr and R_hat. `trace_summary.json` holds the training
trace minima and every 100th step.

**Result** (99problems, 2026-09-19; `run.log`, `*.eval.json`).

| | chain_10_P_1 | chain_10_O_1 | chain_32_P_0.5 |
|---|---|---|---|
| exact | -12.784906443 | -12.381489999655 | -34.033421119168 |
| VarBench row (2023-01-09, no code) | -12.785231(48) | -12.381718(22) | -34.033633(56) |
| linked script, final estimate | -12.784382(65) | -12.381393(27) | -34.03197(10) |
| full summation of the same parameters | -12.784376 | -12.381411 | - |
| five repeats, scatter about the full sum | <= 1.5 sigma | <= 2.2 sigma | <= 2.2 sigma about the printed value |
| training-trace minimum | -12.79495 | -12.38785 | -34.04687 |

**Conclusion.** The script's own estimator is unbiased and lands above the exact energy in all
three cases; the stored values (a better-converged state, variance about half of the rerun's,
biased 2-3e-4 below exact) are not reproducible from anything published. VarBench history:
`6e7a021` (2023-01-09) replaced -12.784707(48) and -12.381447(21) of 2022-12-12, both above
exact; the code links were attached on 2024-07-30 (`5047bfd`) without regenerating a number.

**Reproduce.** `bash checks/tfising-rbm-varbench-rerun/run.sh` in a copy of
varbench/methods `programs/vmc_netket` (~35 min, CPU, 8 cores; `eval_final.py` goes next
to `vmc.py`).

## `peps-4x4-open-ed/`: the S.S convention of arXiv:1611.09467

**Question.** Are the two finite-PEPS energies on the open 6x6 cluster (Table II, D = 8 and
D = 10) in the same convention as the instance's exact row, so that their dip below it is
real and not a constant shift or a per-bond mislabel?

**Result.** `ed_4x4_open.py` (Lanczos, Sz = 0, H = sum S_i.S_j) reproduces the paper's 4x4
"Exact" -0.57432544 per site to 1.6e-9, so the table is per site in S.S units with no shift.
The dip is in the numbers (1.2 sigma at D = 8, 13 sigma at D = 10) on a bar the paper says is
sampling-only over a PEPS contracted at Dc = 2D.

## `hqt-figure-readings/`: what arXiv:2607.00398 plots against what it prints

**Question.** The paper prints three different variances for its 8x8 J2 = 0.5 state and
reads its 10x10 number off a training curve. What do the figures actually show?

**Result.** `digitise_figs.py` calibrates the axes of Fig. 2(a) and Fig. 3 from the
e-print's image files (tick rows and gridlines, checked against matplotlib's 5 % autoscale
margin and against the Chen & Heyl reference line, which reads -0.497687 against the printed
-0.497715) and reads every plotted point (`digitise_figs.out.txt`). The J2 = 0.5 scan point
of Fig. 2(a) sits at E/N ~ -0.485 with sigma^2 ~ 0.094, not at the -0.5001 / 1.4e-3 of
Table 1; the Fig. 3 trace tail (iterations 80-109) has mean -0.497813, sd 2.4e-5, last
iterate -0.497827, which is the printed -0.49782(3).

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
