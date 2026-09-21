# Cost to reproduce: QMBL's own runs on one machine

Ten rows in the table state what they cost in hours; the rest do not, and the
[estimated FLOPs](../../DATA.md#how-a-flop-count-is-estimated) are good to an order of
magnitude. The only cost figures that are comparable across methods are ones measured on
the same hardware under the same protocol, so QMBL runs the common ansätze itself, with
public code, and attaches each run as **a row of its own** with `computed_by: "qmbl"`
([DATA.md](../../DATA.md#rows-qmbl-computed-computed_by)). A run reproduces a *method*, not
a paper's number: it is QMBL's implementation, QMBL's hyperparameters and QMBL's budget,
and the row says so in its method string. Nothing here is attached to anyone else's row.

## Protocol (Tristan, 2026-09-21)

- **Hardware.** One NVIDIA A100 80 GB PCIe on Euler (`gpupr` partitions, pinned with
  `--gres=gpumem:80g` and checked by the job script; the type request alone once landed on a 40 GB card) for the neural states; 8 CPU cores of the same cluster for DMRG. The device model,
  node, Slurm job id and software versions are in every results file.
- **Clock.** Wall-clock from process start to the end of the final evaluation, measured in
  the process (`time.perf_counter`), JIT compilation and sampling included. `gpu_hours` is
  that wall-clock in hours times one GPU; `cpu_core_hours` is wall-clock times the cores
  allocated (not utilised: a Slurm allocation is what a user pays for).
- **Neural states** (`run_nqs.py`, NetKet 3.22.4). One protocol for every ansatz:
  Metropolis exchange sampler (`d_max` 2) in the S_z = 0 sector, 1024 chains, 4096 samples
  per step, 16 discarded per chain, **2000 optimisation steps**, then a final evaluation on
  fresh chains with 131072 samples (1024 chains, 64 discarded per chain); the row's energy,
  error bar, variance, autocorrelation time and R-hat are the final evaluation's. Stochastic
  reconfiguration with learning rate 0.01 and diagonal shift 0.01 where the Jacobian is
  tall (RBM, symmetric RBM), minSR (`use_ntk`) with learning rate 0.02 and diagonal shift
  1e-4 where it is wide (GCNN, ViT). One seed, 20260921. No annealing, no pre-training, no
  symmetry restoration after the fact, no Lanczos step. The per-step energy trace and the
  final parameters are kept beside the results file.
- **Ansätze.** `RBM (alpha = 1)`; translation-symmetric `RBM (alpha = 4)`, kernel
  initialised at 0.01 / sqrt(N) (NetKet's default start is unsampleable on 100 sites);
  NetKet's `GCNN` over the translation group, 4 layers, 8 features (the full space group
  costs its 8x size squared per step, 78 h on 10 x 10); a `ViT` with factored attention,
  2 x 2 patches, d = 60, 10 heads, 4 layers, QMBL's own implementation of the published
  architecture (`vit.py`).
- **DMRG** (`run_dmrg.py`, TeNPy). Two-site DMRG on the torus as a finite MPS with
  long-range couplings, S_z conserved, mixer on, a ladder of maximum bond dimensions
  500, 1000, 2000 in one process, at most 20 sweeps per rung, converged at 1e-8 in the
  energy. Each rung is a row; its cost is the wall-clock since process start, so reaching
  chi = 2000 is costed with the rungs before it.
- **Instances.** `J1J2/square_100_P_0.5` and `Heisenberg/triangular_36_P` (exact energy
  known, -80.6937689612426 Pauli total) in the first batch.
- **Units.** NetKet's `Heisenberg` and TeNPy's spin couplings differ by the factor 4 between
  Pauli and S.S; both scripts write Pauli totals, the instances' stored convention, and
  `run_nqs.py --ed-check` asserts the convention on a 4 x 4 lattice against the literature.

## What a run becomes

`scripts/add_cost_runs.mjs` reads `results/*.json` and appends one row per result (per
rung for DMRG): `bound_type: variational`, `computed_by: "qmbl"`, `reference` naming this
directory and the job, a `verified` block quoting the results file's values, and a `compute`
block whose every field is measured (`scope: row`, `confidence: high`, `reported_as` the
same values, `source` the results file, job and commit). The row ranks like any other and can hold a record; a QMBL run beating every
published number would mean nobody has published a good number for that instance, the same
reading RULES.md 8.2 gives a VarBench baseline.

## Files

- `run_nqs.py`, `vit.py` — the neural-state runs. `run_dmrg.py` — DMRG.
- `euler/` — the sbatch scripts as submitted, and `submit.sh`.
- `results/` — one JSON per run, with its `.trace.jsonl` and `.params.msgpack`.
