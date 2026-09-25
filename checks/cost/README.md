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
  per step, 16 discarded per chain, **2000 optimisation steps**, then a final evaluation
  with 131072 samples on the training chains carried on (64 more discarded per chain; if
  R-hat is still above 1.05, 1024 more and one repeat); the row's energy, error bar,
  variance, autocorrelation time and R-hat are the final evaluation's, and a run whose
  final R-hat is not below 1.05 is not a row. Stochastic
  reconfiguration, learning rate 0.01, with a shift **relative** to the diagonal of the
  geometric tensor, S + 1e-6 I + 0.01 diag S (an absolute shift is a per-model guess: the
  log-derivatives of a translation-symmetric network are N times a dense network's, and
  0.01 absolute sent the symmetric RBM and the GCNN on 10 x 10 to 1e37 in two steps in the
  smoke jobs). Solved by Cholesky on the dense S where there are no more real parameters than
  samples, by conjugate gradients on the Jacobian (300 iterations at most) where there are
  more (S is then rank-deficient and its dense form does not fit); the row records which. The
  learning rate ramps linearly from 0 over the first 200 steps (from a near-uniform start
  the first full-rate natural-gradient step threw the symmetric RBM on 10 x 10 to NaN; at a
  tenth of the rate it descended cleanly). **Divergence rule:** a step's energy is *sane* when it is
  finite and inside the Hamiltonian's own bound, |E| <= 2 n_conn - every term of these spin
  models has Pauli norm 1, so no state of any ansatz can be outside it; on an insane energy
  the parameters are restored from the last sane state kept (every 50 steps), the learning
  rate is halved for the rest of the run, and the run goes on; after five such recoveries it
  stops and is not a row. Everything spent is on the clock and the row's
  note says what happened. One seed, 20260921. No annealing, no pre-training, no symmetry
  restoration after the fact, no Lanczos step. The per-step energy trace and the final
  parameters are kept beside the results file.
- **Ansätze.** `RBM (alpha = 1)`; translation-symmetric `RBM (alpha = 4)`, kernel
  initialised at 0.01 / sqrt(N) (NetKet's default start is unsampleable on 100 sites);
  NetKet's `GCNN` over the translation group, 4 layers, 8 features (the full space group
  costs its 8x size squared per step, 78 h on 10 x 10); a `ViT` with factored attention,
  2 x 2 patches, d = 60, 10 heads, 4 layers, QMBL's own implementation of the published
  architecture (`vit.py`).
- **DMRG** (`run_dmrg.py`, TeNPy). Two-site DMRG on the torus as a finite MPS with
  long-range couplings, S_z conserved, mixer on, a ladder of maximum bond dimensions
  500, 1000, 2000 in one process, a new engine per rung on the previous rung's state, at
  most 15 sweeps per rung or converged at 1e-6 in the energy. Each rung is a row; its cost
  is the wall-clock since process start, so reaching chi = 2000 is costed with the rungs
  before it. On the 120 h CPU partition: a sweep scales as chi^3, and the 10 x 10 torus took
  6 min per sweep at chi = 500.
- **Instances.** `J1J2/square_100_P_0.5` and `Heisenberg/triangular_36_P` (exact energy
  known, -80.6937689612426 Pauli total) in the first batch.
- **Units.** NetKet's `Heisenberg` and TeNPy's spin couplings differ by the factor 4 between
  Pauli and S.S; both scripts write Pauli totals, the instances' stored convention, and
  `run_nqs.py --ed-check` asserts the convention on a 4 x 4 lattice against the literature.

### Amendments

- **2026-09-21 evening (v1.1), after the first batch.** The final evaluation carries the
  training chains on instead of starting fresh ones: from random configurations the
  symmetric RBM's chains on 10 x 10 had R-hat 1.41 after 64 discards (job 14765875,
  -156 ± 4 for a state whose training trace read -196.1), and the R-hat gate and repeat
  were added. The divergence rule was added after the GCNN on the triangular lattice went
  to NaN at step 396 (job 14765878). The DMRG ladder had been re-running chi = 500 for
  every rung (chi_reached in the results file; TeNPy's engine keeps the trunc_params it
  was built with), so each rung now gets its own engine; the sweep cap went from 20 at
  1e-8 to 15 at 1e-6 and the jobs to the 120 h partition, since a chi = 2000 sweep on the
  10 x 10 torus is 64 times a chi = 500 one. The five rows from the first batch (RBM on
  both instances, symmetric RBM and ViT on the triangular lattice, GCNN on J1-J2) were
  evaluated on fresh chains with R-hat 1.004-1.005 and stand; their notes say so. Failed
  runs' files are kept under `results/failed/`; nothing there is a row.

- **2026-09-21 night (v1.2), after the GCNN rerun.** The first divergence rule kept any
  *finite* energy as its fallback, so the GCNN on the triangular lattice restored from a
  step whose energy was -5e18 and died immediately after (job 14793325, three recoveries in
  200 steps). A fallback state now has to be sane in the sense above, an energy ten times
  below the best is itself treated as a divergence rather than waited out, the recovery
  budget is five, and the results file records the energy at each divergence and at the
  state restored from. No committed row went through a recovery, so nothing is re-run for
  this.

- **2026-09-22 (v1.3), after the GCNN converged under a misfiring rule.** Scaling the
  sanity bound by the best energy so far is meaningless while the energy descends *through*
  zero: the GCNN's rerun (job 14844477) recovered three times at -2.2, -1.0 and -1.1, all
  of them ordinary steps, and finished at a learning rate eight times below the protocol's.
  It reached -0.557874/site, but under a different optimisation than every other row, so it
  is not a row. The bound is now the Hamiltonian's own, |E| <= 2 n_conn, which no state can
  leave and which needs nothing from the run.

- **2026-09-24 (v1.4), after the same run cost 2.5 times as much on another node.** The
  DMRG calibration rung (triangular 36, χ = 500) took 3.4 core-h on one node and 8.7 on
  another of the same partition, with the same sweeps and the same energy. Slurm pins a job to
  its own cores, so the difference lies in what the cores share with other jobs: clock, memory
  bandwidth and L3 cache. Euler's accounting records no per-job CPU time.
  - **What every results file now carries** (`monitor.py`, block `resources`): the process's
    own CPU time and CPU time / (wall-clock × cores); the clock of its cores, sampled every
    30 s; the node's load average against its core count; and for a GPU run, the GPU's SM clock,
    utilisation and power.
  - **All 14 rows were rerun under v1.4 (Tristan, 2026-09-24)**, so every row carries these
    numbers. The optimisation, sampling and evaluation are unchanged. The DMRG reruns also
    record TeNPy's Lanczos count, which the FLOP model needs.

- **2026-09-25: a configuration run more than once is stored as its best run** (Tristan). Runs
  of one configuration with the same seed differ, because XLA's GPU arithmetic is not
  deterministic.
  - **Where it matters:** on triangular 36 the difference decides whether the GCNN blows up
    and whether the ViT stalls. On J1-J2 10 × 10 repeated runs agree to about 1e-4 per site.
  - **The rule:** the row is the lowest final energy among the configuration's v1.4 runs that
    stand. [`best_run.mjs`](best_run.mjs) keeps every run in `results/runs/` and writes the
    chosen one to `results/<name>.json`. `euler/sync.sh --fetch` calls it.
  - **What the row says:** its note gives the number of runs, not their spread. v1.3 runs are
    not candidates, because they lack the hardware record.

- **2026-09-25 (v1.5), the size ladder (Tristan, 2026-09-24).** To read cost against system
  size, every ansatz above runs on J1-J2 at J2 = 0.5 on the periodic L x L squares, L = 4, 6,
  8, 10, 12, 14, 16, under the protocol unchanged (the same sampler, samples, 2000 steps,
  optimizer and evaluation at every size), and DMRG on 6 x 6, 8 x 8 and 12 x 12 on Euler as
  above.
  - **The neural states run on one NVIDIA H100 NVL 96 GB of a group host**, not on Euler's
    A100s: Euler's A100 queue is the bottleneck, and Tristan allowed one such card by day for
    this ladder beyond the host's day cap. One card, one run after another
    (`h100/ladder.sh`, deployed by `h100/deploy.sh` with NetKet 3.22.4, jax 0.8.3 and flax
    0.12.6, the Euler versions); the card is one the host's GPU policy lists as idle.
  - **A second device is a second protocol for hours.** A ladder row's hours compare with the
    other ladder rows, never with the A100 rows; its method string and results file name
    (`h100-*`) say which, and 10 x 10 is run again on the H100 so the ladder is complete on one
    device. The host is shared and has no scheduler, so the resources block (node load, clocks)
    matters more here than on Euler.

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
- `results/` — one JSON per configuration (the best of its runs), with its `.trace.jsonl` and `.params.msgpack`; `results/runs/` holds every v1.4 run as `<name>--<Slurm job>.json` with its trace, never rows.
- `calibration/` — runs made to calibrate an estimate, never rows (`add_cost_runs.mjs` reads
  `results/` only). `dmrg-cal-tri-36` repeats the chi = 500 rung on the triangular 36 torus
  to record how many effective-Hamiltonian applications TeNPy's Lanczos took per two-site
  update, the one input of the DMRG FLOP model (DATA.md) that TeNPy decides adaptively.
  From 2026-09-23 every DMRG rung also records its final bond-dimension profile and these
  Lanczos counts; the protocol is unchanged.
