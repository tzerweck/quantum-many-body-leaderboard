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

**Result** (`results-tfising-rbm.json`, an AMD EPYC 9554 server with NVIDIA L40S cards, netket 3.22.4, 2026-09-11).

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

**Result** (an AMD EPYC 9654 server with NVIDIA H100 NVL cards, 2026-09-19; `run.log`, `*.eval.json`).

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
resolve. Since 2026-10-02 that is all six (ruling E6, from the reading of 2026-09-29): the
14-site chain's DMRG row resolves the 3.0e-9 between its two couplings (its variance, 8.2e-12,
puts it within 7e-11 of the ground state at U = 4.64158882, and it sits 2.2e-9 below the one at
4.64158883), and the 4 + 4 DMRG row whose script is a copy of the U = 10 file belongs to
U = 7.74264 by its sibling 5 + 5 script and its variance-to-error ratio (1.16 there, 0.18 at
7.74263683, against about 1.3 for the series). Their exact rows at the named U are in
`ed_results.jsonl` and `logs_fermions_small.log`.

**Reproduce.**

```bash
node run_fermions.mjs Hubbard/square_16_P_5_2.1544 Hubbard/square_16_P_5_2.1544@2.15443469   # ~4 min each, ~1 GB
python ed_check.py '[{"lattice":"square","L":4,"n":5,"U":2.15443469}]' out.jsonl
```

## `pyrochlore-32-ed/`: is VarBench's exact energy on the 32-site pyrochlore the ground state?

**Question.** VarBench carries `Exact diagonalization` -66.1514 on `Heisenberg/pyrochlore-2x2x2_32_P`
(-0.5168078 per site in S.S units). The papers that diagonalized this cluster print E/N = -0.5168
and a triplet gap of 0.6872 (arXiv:2010.03563 Table I; arXiv:2101.08787 Table II), four digits that
do not decide between that number and a lower one. Is the stored energy the ground state?

**Design.** Lanczos ground state of `H = sum_b sigma_i . sigma_j` (Pauli) on the cluster VarBench's
own generator builds: `programs/mVMC_RBM/src/StdFace/Pyrochlore.c` of varbench/methods, 2 x 2 x 2
fcc cells of four sites, 96 bonds, every site six-fold, cross-checked against a real-space
nearest-neighbour list. Two codes on an AMD EPYC 9654 server, 2026-09-16: `ed_full.py`, matrix-free over the
whole S^z = 0 space (601,080,390 states, no spatial symmetry, true residual measured on a rebuilt
Ritz vector), and `ed_perm.py` (with `ed_sym.py`), in the fully symmetric sector of the cluster's
384-element space group times spin inversion (789,438 states). An S^z = 1 run gives the triplet gap.

**Result.** -66.15792523719963 (`ed_full.py`, residual 6.9e-10) and -66.15792523721132
(`ed_perm.py`, residual 6.3e-10), 1.2e-11 apart; E/N = -0.51685879. The lowest S^z = 1 level,
-63.4091232, gives the gap (E1 - E0)/4 = 0.68720, the papers' 0.6872, so this is their cluster; their
-0.5168 is this energy truncated. The stored -66.1514 sits 6.5e-3 above the ground state, 65 times
the 1e-4 it is printed to.

**Conclusion.** Not the ground-state energy at its own precision: the row is removed and the
recomputed energy stands (RULES.md §11; `scripts/removals.mjs`, `scripts/add_exact_rows.mjs`
batch B2; ruled 2026-09-29).

**Reproduce.** About 55 min and 19 GB on 64 threads for the full space, 1.5 min and 5 GB on 16
threads for the symmetric sector (numba):

```bash
python ed_full.py --model heis_pyrochlore --L 2 --instance Heisenberg/pyrochlore-2x2x2_32_P --out full.json
python ed_perm.py --W 2 --subgroup full --outdir sectors
```

## `hubbard-4x4-half-filling-ed/`: are the 4x4 Hubbard ED rows at half filling the ground state?

**Question.** `Hubbard/square_16_P_8_4` and `square_16_P_8_8` carried `ED` -13.62192 and -8.46896:
the per-site values -0.85137 and -0.52931 that arXiv:2602.03031 quotes from Anderson et al.,
Comput. Theor. Chem. 1003, 22 (2013), times 16. The producer prints the totals -13.6219 and
-8.46888 (arXiv:1207.4847, Table IV). Is either stored value the ground state at its own precision?

**Design.** Lanczos ground state of `H = -t sum (c+c + h.c.) + U sum n_up n_dn`, t = 1, on the
periodic 4x4 lattice (32 bonds), N_up = N_dn = 8, no spatial symmetry (165,636,900 states; by
Lieb's theorem the half-filled ground state is the unique singlet, so the (8, 8) sector holds it).
Two codes on an AMD EPYC 9654 server, 2026-09-29: `ed_full2.py` (code B: the pyrochlore-32
`ed_full.py` with a fixed-(N_up, N_dn) Hubbard kernel, plain Lanczos, true residual measured on the
rebuilt Ritz vector) and `hub_fact.py` (code A: the factorised matvec T x 1 + 1 x T + U D of
`checks/hubbard-u-labels/ed_check.py`, copied unchanged as `ed_check.py`, driven by ARPACK). Both
first reproduced solved cases to 1e-9 (`validation/`: code B the 14-site chain at 4 + 4, U = 1, and
the 4x4 lattice at 5 + 5, U = 4, and 4 + 4, U = 8; code A the chain and the 4x4 lattice at 4 + 4,
U = 4).

**Result.** U = 4: -13.621854821161437 (code B, residual 5.2e-11) and -13.621854821162666 (code A,
residual 9.8e-12), 1.2e-12 apart; E/N = -0.851365926. U = 8: -8.468875014199401 (code B, residual
3.7e-11) and -8.468875014196898 (code A, residual 5.7e-12), 2.5e-12 apart; E/N = -0.529304688.
The stored -13.62192 lies 6.5e-5 and -8.46896 8.5e-5 below the ground state, beyond the producer's
print precision; the producer's -13.6219 and -8.46888 are the ground state at their printed digits,
and the quote's -0.52931 is one unit off in its last digit. Qin, Shi & Zhang's AFQMC on the same
instances, -13.616(6) and -8.476(9), is 1.0 and 0.8 sigma away.

**Conclusion.** The rows carried a per-site rounding times 16 that lies below the ground state, not
the exact energy: QMBL's recomputed energies stand, to the 10 decimals the two codes agree on
(`scripts/add_exact_rows.mjs` batch B2). The U = 8 quote is removed (`scripts/removals.mjs`); the
U = 4 quote is QMBL's energy rounded to its printed digits, so `add_allresults_rows.mjs` skips it as
the exact row already carried. Ruled 2026-09-30.

**Reproduce.** About 7 min and 5 GB on 32 threads (code B), 30 min and 26 GB on 4 threads (code A),
with numpy, scipy and numba:

```bash
python ed_full2.py --model hubbard --lattice square --L 4 --nup 8 --ndn 8 --U 4 --instance Hubbard/square_16_P_8_4 --out Hubbard__square_16_P_8_4__B.json --tol 1e-10
python hub_fact.py --lattice square --L 4 --n 8 --U 4 --threads 4 --k 1 --ncv 12 --instance Hubbard/square_16_P_8_4 --out Hubbard__square_16_P_8_4__A.json
```

## `exact-recompute-2026-09/`: which printed exact energies are QMBL's value rounded?

**Question.** Several exact rows carry an energy printed to 6 or 9 digits. Where the printed value
is the true ground state rounded or truncated to those digits, the row can carry the full value;
where it is neither, the printed value is not the ground state at its own precision. Which is which
for the rows recomputed in the verification pass of 2026-09-29?

**Design.** Lanczos ground states on an AMD EPYC 9654 server, 2026-09-29 (the shuriken's second
code ran in the pass of 2026-09-15). Shuriken 24 (the "D4 symmetric 6x2^2 cluster" of arXiv:2110.08198, Supplement Sec. I,
48 bonds): `ed_full2.py` over the whole S^z = 0 space (2,704,156 states) and `run_spins.mjs` (node,
with `ed_lib.mjs`). Kagome clusters 12, 24, 30, 36a, 36b, 36c and 36d of Läuchli, Sudan & Sørensen,
PRB 83, 212401 (2011), Table I (basis vectors as printed, except 36b: its printed b = (-3,4) gives
a cluster equivalent to 36c, and (-2,4) reproduces the printed energy; bonds by nearest-neighbour
search, `gen_clusters.mjs` -> `clusters/`): `ed_full2.py` over the full space for 12, 24 and 30, and
`ed_perm2.py` (cluster space group, real 1D characters, on the `ed_perm.py` and `ed_sym.py` kernels
of the pyrochlore-32 check) for all seven, at k = 0 and spin-inversion even for the 36-site
clusters, for which that basis is the only one computed. On 30 the real characters miss the ground
state, which carries a complex momentum pair (their lowest level lies 0.0116 higher), so the full
space is the one determination there. J1-J2 on the 6x6 torus at J2 = 0.1, 0.2, 0.55, 0.65: `ed_sym.py` in the C4v
A1 sector at k = 0, a second basis (`c2v_axes`, which holds A1 + B1), and a screening of the other
irreps at k = 0 and M (`*__summary.jsonl` lists every sector computed).

**Result.** Printed value against the recomputed energy (Pauli totals; printed values in the
source's units):

| row | printed | stored | recomputed | printed is |
|---|---|---|---|---|
| `Heisenberg/shuriken_24_P` | -0.448329 per site (the author's upload; the paper plots it) | -43.039584 | -43.0395889922721 | rounded |
| `Heisenberg/kagome-2x2_12_P` | -5.444875216 (S.S total) | -21.779500864 | -21.779500867887435 | truncated |
| `Heisenberg/kagome-24_24_P` | -10.589965547 | -42.359862188 | -42.35986218805902 | rounded |
| `Heisenberg/kagome-30_30_P` | -13.154318948 | -52.617275792 | -52.61727579388159 | rounded |
| `Heisenberg/kagome-36a_36_P` | -15.787874847 | -63.151499388 | -63.15149939025944 | truncated |
| `Heisenberg/kagome-36b_36_P` | -15.806927756 | -63.227711024 | -63.22771102445205 | rounded |
| `Heisenberg/kagome-36c_36_P` | -15.814334002 | -63.257336008 | -63.257336011794834 | truncated |
| `Heisenberg/kagome-36d_36_P` | -15.781555118 | -63.126220472 | -63.12622047596263 | truncated |
| `J1J2/square_36_P_0.2` | -0.599046 per site | -86.262624 | -86.26267036121452 | rounded |
| `J1J2/square_36_P_0.55` | -0.495178 per site | -71.305632 | -71.30558885966441 | rounded |
| `J1J2/square_36_P_0.65` | -0.506588 per site | -72.948672 | -72.9486516516581 | rounded |
| `J1J2/square_36_P_0.1` | -0.638096 per site | -91.885824 | -91.88574274986225 | neither (-0.638095436) |

The two shuriken codes agree to 6.4e-11, the two kagome-12 bases to 1e-14, the two kagome-24 bases
to 1.4e-13, and the two J1-J2 bases to 6e-13 or better; every residual is below 1e-9.

**Conclusion.** The eleven rows whose printed value is the recomputed energy rounded or truncated
keep their citation and carry QMBL's digits, with the printed value kept on the row
(`scripts/corrections.mjs`; rule of 2026-09-30, kagome 24, 30 and 36b by the ruling of
2026-10-02). J2 = 0.1 keeps the paper's -0.638096 (ruled
2026-09-30); the recompute is in its verification note.

**The 32-site t-V chains (ruling of 2026-10-02).** VarBench's exact rows on `tV/chain_32_P_16_1`,
`_2` and `_4` link a lattice-symmetries script that fixes every symmetry sector to 0, and their
numbers came from a QuSpin run whose script is not in VarBench's methods repository. `ed_full.py`
over the full N_f = 16 space (601,080,390 states, no spatial symmetry; verification pass of
2026-09-17, 64 threads, about 5.5 min and 19 GB each) reproduces the three stored energies to
2.1e-13 relative or better, residuals below 1e-9, with a translation expectation of zero: the
ground state is the K = ±π/2 doublet (`results/tV__chain_32_P_16_*.json`). The rows cite these
files beside the script link.

**Reproduce.** Seconds for the shuriken and kagomes 12 and 24 (the node code takes 15 min), 46 min
and 5 GB on 32 threads for the full kagome-30 space, 10 to 30 min and 77 to 83 GB on 96 threads per
36-site kagome sector, about a minute and 72 GB per 6x6 J1-J2 sector (numpy,
numba):

```bash
python ed_full2.py --model heis_bonds --bonds clusters/shuriken_24.json --instance Heisenberg/shuriken_24_P --out shuriken.json --tol 1e-11
node run_spins.mjs Heisenberg/shuriken_24_P
python ed_perm2.py --cluster clusters/kagome_36a.json --chars gamma --z 1 --outdir results --tol 1e-9
python ed_sym.py --lattice square --L 6 --name J1J2__square_36_P --outdir results --group c4v --tol 1e-9 --second_pass 1 --tasks '0.2/0,0/A1/1'
python ed_full.py --model tv_chain --L 32 --Nf 16 --V 1 --instance tV/chain_32_P_16_1 --out results/tV__chain_32_P_16_1.json
```
