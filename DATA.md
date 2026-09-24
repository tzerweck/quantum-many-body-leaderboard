# QMBL data

What the files in `data/` contain and how to read them. The leaderboard is in
[README.md](README.md); the rules that decide a record are in [RULES.md](RULES.md).

## What is in the data

`data/<Model>/<instance>.json`, one file per instance, plus `data/_summary.json`.

This is the row currently holding the 10×10 J1-J2 record, with its long text fields cut:

```json
{
  "model": "J1J2", "lattice": "square", "n_sites": 100, "boundary": "P",
  "params": { "J2": 0.5 },
  "instance_id": "J1J2/square_100_P_0.5",
  "rows": [
    {
      "energy": -199.07756, "sigma": 0.00008, "energy_variance": null,
      "dof": 100, "einf": 0, "v_score": null,
      "method": "CNN-MPS",
      "method_detail": "h = 32, l = 20, Marshall sign",
      "method_as_published": "CNN-MPS (h,D,l)=(32,20,20), Marshall sign transformation",
      "family": "tensor network",
      "bound_type": "variational",
      "bound_type_reason": "variational ansatz; energy is a strict upper bound (assigned during source verification)",
      "reference": "arXiv:2603.14425, Disentangling Tensor Network States with Deep Neural Networks",
      "peer_reviewed": false,
      "source": "sweep-2026-09-13",
      "provenance": "primary",
      "verified": {
        "checked_on": "2026-09-13",
        "method": "arXiv HTML parsed locally, no LLM transcription",
        "reported_as": "-0.4976939 (+/- 2e-7) per site in S.S units",
        "note": "Read from Table 1 of arXiv:2603.14425 ... Supersedes Chen & Heyl -0.4976921(4) as the record for this instance.",
        "secondary_of": null
      },
      "compute": {
        "parameters": 200000, "samples": 4096, "bond_dimension": 20, "iterations": 15000,
        "reported_as": "...", "source": "Supplementary Material Sec. S3.A and Table S1, arXiv:2603.14425 (compute pass 2026-09-16)",
        "scope": "ansatz", "confidence": "medium", "note": "..."
      }
    }
  ]
}
```

A method is stored three ways. `method` is its name alone. `method_detail` holds what tells
the row apart from other rows of that name (architecture size, projection, Lanczos steps,
trial state, what an extrapolation sends to zero) and never repeats the kind, the instance
or the source. `method_as_published` is the string exactly as the source printed it. A bond
dimension, parameter count or sample count lives in `compute`, not in the detail, and the
site prints the three as one label: "CNN-MPS (bond dimension 20, h = 32, l = 20, Marshall
sign)". `family` groups methods for the figures, and `sector` marks an exact diagonalization
restricted to one symmetry sector. All of these are assigned in
[`scripts/method_names.mjs`](scripts/method_names.mjs), one entry per published string.

`baseline: true` marks a row VarBench **computed itself** rather than collected from a
paper: a reference calculation run across the instance set so the V-score would have
something to measure against, not a published state-of-the-art claim. 376 of the 583
imported rows are of this kind. 75 of VarBench's own exact diagonalizations hold their
instance's record, as any exact energy does ([§6](RULES.md#6-records-and-ties)), and 27
of its variational reference runs do, which means *no published result has ever beaten the
benchmark's own reference run on those instances*
(`baseline_records` in `data/_summary.json` counts the latter). See
[§8.2](RULES.md#82-baseline-collected-versus-computed).

### Rows QMBL computed: `computed_by`

`computed_by: "qmbl"` marks a row QMBL ran itself, under the protocol in
[`checks/cost/README.md`](checks/cost/README.md): the common ansätze on one machine, so
that the table has cost figures that are comparable across methods (Tristan, 2026-09-21).
It is the QMBL analogue of VarBench's `baseline`, and the same reading applies: a QMBL run
holding a record means nobody has published a better number, not that QMBL claims one. A
run is QMBL's implementation, hyperparameters and budget, never the authors', and its
method string says so ("ViT (...), QMBL cost-to-reproduce run"); a state QMBL trained is
never attached to anyone else's row. The row's `reference` names the run, the Slurm job
and the commit; `verified.reported_as` and `compute.reported_as` quote the committed
results file under `checks/cost/results/`; every `compute` field is measured in the
run's own process, `scope: row`, `confidence: high`. The validator requires all of it.
Rows are attached by [`scripts/add_cost_runs.mjs`](scripts/add_cost_runs.mjs).

`energy` and `sigma` are stored in the instance's own convention; `v_score` is derived,
never supplied. `verified` records where the number was read from and how: table
parsed from arXiv HTML locally, never an LLM's summary of a table, after that was caught
mangling columns and inventing electron counts. `defect` appears on a flagged row and
carries the reason.

**A missing field never excludes a row**: completeness is a property of the row, not an
admission gate, and only [RULES.md §6](RULES.md#6-records-and-ties) and
[§6.1](RULES.md#61-a-flagged-row-cannot-hold-a-record) govern what can hold a record.

## What a number cost: the `compute` block

Optional, per row. It is what makes the accuracy-versus-cost view possible: an energy is
only half of a result, and the field argues informally about the other half.

```json
"compute": {
  "parameters": 267720,
  "gpu_hours": null,
  "device": "NVIDIA A100",
  "n_devices": 20,
  "samples": 6000,
  "wall_clock": "four days",
  "cpu_core_hours": null,
  "bond_dimension": null,
  "iterations": null,
  "reported_as": "the sentence(s) the numbers were read from, verbatim",
  "source": "Sec. II, Table I, arXiv:2310.05715 (compute pass 2026-09-16)",
  "scope": "row | ansatz | paper",
  "confidence": "high | medium | low",
  "note": "what a reader needs: what the paper gives instead of a missing field, which run the statement is about"
}
```

The four fields after `wall_clock` are the cost metrics of methods that are not neural
networks: CPU core-hours and bond dimension for tensor networks and exact diagonalization,
sample and iteration counts for Monte Carlo. They are recorded in their own units and never
translated into GPU-hours. `scope` says what the statement covers - this row, this ansatz
across sizes, or the paper as a whole - and `confidence` drops to `medium` where a count
was evaluated from a formula the paper prints, `low` where the only statement is second-hand
or an acknowledgement naming a supercomputer.

A DMRG row whose run script is public also carries `sweep_schedule`, what the script states
about the run rather than what it cost:

```json
"sweep_schedule": {
  "code": "ITensors.jl 0.6.16",
  "maxdim": [1024, 1024, "... one maximum bond dimension per sweep"],
  "eigensolver_applications": 3,
  "eigensolver_source": "ITensors.jl 0.6.16 dmrg(): eigsolve_krylovdim = 3, eigsolve_maxiter = 1 (defaults, not overridden)",
  "variance_after": [50],
  "start": "random MPS at bond dimension 1024",
  "cutoff": 1e-12,
  "lattice": { "order": "snake", "rows": 10, "cols": 10, "wrap_row": true, "wrap_col": true,
               "diagonals": ["\\", "/"], "site_dimension": 2, "operators_per_bond": 3 }
}
```

`maxdim` has one entry per sweep (`iterations` is its length, or for a QMBL rung the sweeps
of that rung alone). `variance_after` lists the sweeps after which the script evaluates
⟨ψ|H H|ψ⟩. `eigensolver_applications` is the most effective-Hamiltonian applications per
two-site update the code's eigensolver makes, with the source it was read from. `lattice` is
the site order and couplings the script builds its MPO from, so the MPO's size can be
recomputed. None of this is a cost. It is the input to the one estimate QMBL makes for
DMRG (next section).

Blocks are attached by `scripts/add_compute.mjs` from `compute-rows-<date>.json`, one file
per reading pass, applied in date order; the first (2026-09-16) read all 130 papers behind
the non-baseline rows in full, appendices and supplements included, and found a statement
in 81 of them. The second (2026-09-23) read the run script behind each of the 99 VarBench
DMRG rows in [github.com/varbench/methods](https://github.com/varbench/methods) at
`ed31bb0` for its sweep schedule; no script records a time.

Three rules, and they are the whole design:

- **No normalisation.** GPU-hours are stored raw, next to the device model. There is no
  H100-equivalent column and there will not be one: a conversion factor between hardware
  generations is an argument, not a measurement, and it would be the first thing disputed.
  The validator rejects any field that looks normalised.
- **Self-reported and unfalsifiable.** Nothing here is checked against a run. `reported_as`
  carries the authors' own words so a reader can see what was claimed, and is required.
- **Never estimated.** A field nobody stated is `null`, not a guess from the ansatz size.
  "20 A100 GPUs for four days" fills `n_devices`, `device` and `wall_clock` and leaves
  `gpu_hours` null; a figure gives its own "GPU-days" as hours and the note says so. A view
  that multiplies devices by wall-clock does that at draw time and marks the point as
  derived; the stored fields stay as reported. The one estimate QMBL makes, a FLOP count
  from stated counts (parameters, samples and iterations for a network; the sweep schedule
  for DMRG), is evaluated at build time and never stored (next section).

A missing `compute` block excludes nothing, exactly like a missing variance.

### How a FLOP count is estimated

Ten published rows state hours on a named GPU; 58 more state how many parameters the ansatz had,
how many samples each optimisation step drew and how many steps were taken. Those three
numbers, with the instance, fix the number of network evaluations an optimisation took, and
[`scripts/flops.mjs`](scripts/flops.mjs) turns them into floating-point operations at
build time (Tristan, 2026-09-21). That model, `nqs-v1`, is for neural and other variational
Monte Carlo states; DMRG has its own, `dmrg-v1`, at the end of this section.

    FLOPs = iterations × samples × (n_conn + k_sample + 3) × FLOPs_forward
    FLOPs_forward = 2 × parameters × reuse (+ 2/3 N_e³ for a determinant or Pfaffian)

`n_conn` is the number of off-diagonal Hamiltonian terms connected to one configuration,
which is what one local energy costs in network evaluations: the bonds of a Heisenberg
instance, bonds plus next-nearest bonds for J1-J2, the sites for the transverse-field Ising
model, four per bond for Hubbard. `k_sample` is one sweep of N single-site proposals for
Markov-chain sampling and one pass for an autoregressive draw. The 3 is the forward and
backward pass of the gradient. `reuse` is how many times a weight is applied in one
forward pass: once in a dense network, once per site in a convolution or a recurrent cell,
once per patch in a vision transformer; it is declared per architecture in `ARCH`, one
line each, with the sampling scheme and whether a determinant is evaluated.

What is not counted, and is said under every figure that shows an estimate: the
stochastic-reconfiguration solve, symmetry projections that sum the network over a point
group, attention scores, and pre-training on smaller lattices. Against the ten rows that
also state GPU-hours the model implies these achieved rates:

| instance | method | estimated FLOPs | stated | achieved |
|---|---|---|---|---|
| Heisenberg 10×10 open | minGRU, 3 layers, C4v | 7.8e18 | 108 h, L40S | 20 TFLOP/s |
| Heisenberg 16×16 open | minGRU, 3 layers, C4v | 5.3e19 | 696 h, L40S | 21 TFLOP/s |
| J1-J2 10×10, J2 = 0.5 | ViT, T5 / decoupled attention | 1.4e17 | 28 h, A100 | 1.4 TFLOP/s |
| J1-J2 10×10, J2 = 0.5 | ViT, factored attention | 1.2e17 | 12.5 h, A100 | 2.6 TFLOP/s |
| J1-J2 6×6, J2 = 0.5 | ViT, T5 / decoupled attention | 1.8e16 | 10 h, A100 | 0.5 TFLOP/s |
| J1-J2 6×6, J2 = 0.5 | ViT, factored attention | 1.5e16 | 6 h, A100 | 0.7 TFLOP/s |
| J1-J2 20×20, J2 = 0.5 | ViT, symmetry restoration | 6.6e19 | 25000 h, GH200 (whole paper) | ≥ 0.7 TFLOP/s |
| J1-J2 10×10, J2 = 0.5 | RBM α = 1, QMBL run | 8.4e15 | 0.46 h, A100 80 GB (measured) | 5.1 TFLOP/s |
| triangular 36 | RBM α = 1, QMBL run | 1.2e14 | 0.10 h, A100 80 GB (measured) | 0.32 TFLOP/s |
| triangular 36 | ViT, QMBL implementation | 3.4e15 | 2.7 h, A100 80 GB (measured) | 0.35 TFLOP/s |
| triangular 36 | symmetric RBM α = 4, QMBL run | 1.3e13 | 0.12 h, A100 80 GB (measured) | 0.03 TFLOP/s |

Consistent within a paper, a factor of forty across papers, and a factor of 170 between
QMBL's own runs on one card (the last four rows, [`checks/cost/`](checks/cost/README.md)):
a 149-parameter network keeps an A100 busy at 0.03 TFLOP/s, because below ~10^4
parameters the step is launch overhead and sampling, not arithmetic, and the estimate
falls 30-100 times short of the clock. **An estimate is good to an order of magnitude for
a network large enough to fill a GPU and never better**, which is why it has its own axis
and its own figures (`figures/flops/`, `figures/energy-vs-flops.svg`) and is never placed
on the hours axis. Turning FLOPs into hours would need exactly the conversion factor the
first rule forbids. Nothing on the FLOPs axis is a reported number, so the two axes are
never mixed: on the front page an instance with both shows them as two figures, a badge
each.

Three rules, the same shape as the block's own:

- **An input nobody stated is never guessed.** Parameters, samples and iterations must all
  be on the row, the architecture must be in `ARCH`, and the instance must be on a lattice
  whose bond count the script writes. For DMRG the sweep schedule, eigensolver setting and
  site order must be in the run script. Otherwise there is no estimate. The estimate is
  `medium` confidence when those hold and `low` when an architectural assumption was needed
  (a transformer whose patch size the paper does not state) or the block itself is `low`.
- **Nothing is stored.** The estimate is a function of the row and its instance, recomputed
  on every build; changing the model changes every figure at once and no data file.
- **DMRG only where the schedule is stated.** A bond dimension alone does not fix a DMRG
  cost, so only rows with a `sweep_schedule` get one (below): the VarBench rows, from their
  run scripts, and QMBL's own. No DMRG paper in the table states its sweep schedule, a PEPS
  needs its contraction dimension, and the four exact diagonalizations that state seconds per
  matrix-vector product do not state the Lanczos iteration count.

#### DMRG: `dmrg-v1`

For a row with a `sweep_schedule` (Tristan, 2026-09-23), `flops.mjs` counts the dense tensor
contractions of two-site DMRG:

    FLOPs = Σ over sweeps  2 × Σ over the N − 1 two-site updates
              [ n_apply × apply + svd + environment ]
          + one ⟨ψ|H H|ψ⟩ contraction after each sweep in variance_after
    apply       = 2 d² D χ_l χ_r (χ_l + χ_r) + 4 d³ D² χ_l χ_r
    svd         = 4 m n min(m, n),  m = d χ_l,  n = d χ_r
    environment = 2 d D χ_l χ_r (χ_l + χ_r) + 2 d² D² χ_l χ_r
    ⟨H²⟩        = Σ over sites  2 d D² χ_l χ_r (χ_l + χ_r) + 4 d² D³ χ_l χ_r

`d` is the site dimension (2 for spins and spinless fermions, 4 for Hubbard). The bond
dimension at a bond in a sweep is the least of three numbers: the sweep's maximum, the
reached bond dimension the row states (a 16-site tV run capped at 4096 reached 74), and the
exact limit d^min(b, N − b). `n_apply` is the code's own eigensolver setting: at most 3 for
ITensors.jl 0.6.16's defaults (Krylov dimension 3, one pass) and for ITensor C++ at
`niter = 2` (one application, then one per Davidson iteration). For TeNPy, whose Lanczos stops
adaptively, it is the count measured on the calibration run (`checks/cost/calibration/`).
`D`, the MPO bond dimension, is 2 + k × the largest number of sites on the smaller side of
any cut in the script's site order with a coupling across that cut. `k` is the number of
operators per bond: 3 for S⁺S⁻ + S⁻S⁺ + SᶻSᶻ and for tV, 1 for the Ising ZZ, 4 for the two spin
species' hops. For QMBL's runs this bound reproduces the MPO bond dimension TeNPy logs,
68 on the J1-J2 10×10 torus and 41 on triangular 36.

Not counted, and said under every figure that shows a DMRG estimate:
- **conserved quantum numbers.** The model is dense, and block-sparse tensors skip most of
  the contraction, increasingly so as χ grows.
- **the noise or mixer term, the eigensolver's orthogonalisation, and memory traffic.**

**Calibration.** The check is QMBL's own DMRG rungs, whose wall-clock is measured on
8 cores (TeNPy 1.1.1, Sz conserved,
[`checks/cost/`](checks/cost/README.md)). TeNPy's Lanczos count comes from a repeat of the
triangular-36 χ = 500 rung (`checks/cost/calibration/dmrg-cal-tri-36.json`, the same energy to
all printed digits): 3964 applications over 1053 Lanczos updates, **3.76 per update**, from 2
to 20. The 35 updates on the smallest blocks were solved by full diagonalisation. The six
rungs ran before the count was recorded, so their estimates use this 3.76 and are `low`
confidence. Each rung's schedule covers every sweep up to the end of that rung, because the
wall-clock does too.

| instance | rung | estimated FLOPs | measured | achieved per core |
|---|---|---|---|---|
| triangular 36 | χ = 500 | 2.4e14 | 3.7 core-h, EPYC 7H12 | 18 GFLOP/s |
| triangular 36 | χ = 1000 | 1.8e15 | 9.0 core-h, EPYC 7H12 | 57 GFLOP/s |
| triangular 36 | χ = 2000 | 1.3e16 | 24.9 core-h, EPYC 7H12 | 140 GFLOP/s |
| J1-J2 10×10, J2 = 0.5 | χ = 500 | 1.9e15 | 37 core-h, EPYC 7763 | 15 GFLOP/s |
| J1-J2 10×10, J2 = 0.5 | χ = 1000 | 1.6e16 | 88 core-h, EPYC 7763 | 49 GFLOP/s |
| J1-J2 10×10, J2 = 0.5 | χ = 2000 | 1.2e17 | 221 core-h, EPYC 7763 | 144 GFLOP/s |

**The implied rate grows with χ, tenfold from χ = 500 to 2000, almost identically on both lattices.**
One of these cores peaks at about 40-55 GFLOP/s in double precision. From χ ≈ 1000 upward
the model therefore counts more arithmetic than the run did: blocks with different Sz are
never multiplied, and that saving grows with χ. Below it, the run spends time on things the
model does not count.

The clock is itself uncertain. The calibration repeat took 3.4 core-h on one node and
8.7 core-h on another of the same partition, for the same sweeps and the same energy.

**A DMRG estimate is therefore good to an order of magnitude, like a network's.** It
overstates the work of a large-χ run by up to a factor of three against peak. It shares an
axis with the network estimates and, like them, never the hours axis.

## When the literature was last checked: `coverage`

Per instance, not per row, and appended to rather than overwritten:

```json
"coverage": [
  { "checked_on": "2026-09-15", "method": "table harvest of 44 cached sources",
    "screened": ["arXiv:2507.01856", "arXiv:2606.00924"], "found": 2, "note": "" },
  { "checked_on": "2026-09-15", "method": "citation screen of the originating paper",
    "screened_count": 61, "found": 0,
    "note": "Nobody has published a second energy for this Hamiltonian since Sorella (2023)." }
]
```

**A check that found nothing is a result and is recorded as one** (`found: 0`). Only 116 of
341 instances have any 2025-26 row, so a site that says nothing about its own currency
reads as more authoritative than it is. This is the field the instance pages quote, and it
is why "we looked, and there is nothing newer" is worth the same bookkeeping as a new row.
`screened` names the papers when there are few, `screened_count` replaces it when there are
many. `found` is how many of the screened papers the instance carries an energy from, read
off its rows at build time, so it cannot disagree with the page.

## Units and conventions

Stored conventions follow VarBench and are asserted per instance, not per row. The
conversions live in [`scripts/units.mjs`](scripts/units.mjs) and are applied by the
loader, never by hand.

| | stored as | papers usually quote |
|---|---|---|
| Heisenberg, J1-J2 | total energy, **Pauli** (σ·σ) convention | `E/N` in `S·S`: divide by `4 * n_sites` |
| TFIsing | total energy, **Pauli** | `E/N`: divide by `n_sites`; no `S·S` term to rescale |
| Hubbard, t-V | total energy | per site: divide by `n_sites` |
| Impurity | total energy | no meaningful per-site energy |

`dof` is the spin count for spin models, `N_up + N_dn` for Hubbard, and the particle
count for **spinless** t-V. `einf` is `0` for traceless spin Hamiltonians and
`U * N_up * N_dn / n_sites` for the plain Hubbard model.

Getting these wrong is the single most likely source of a false record, which is why
they are stated once and reused rather than inlined per script.

## Error metrics

Some rows carry no error information at all: no error bar, no energy variance, nothing
that says how converged the number is. Those rows are marked **&#9675;** in the README
leaderboard and `o` in `scripts/records.mjs`.

**The marker is about our search, not about the authors.** It records that we did not
find an error metric in the source we read, and that figure may well exist in a
supplement, in a companion paper, or in the group's own records. So the number stays in
the table and stays in the ranking; what the marker says is that the row still wants
verification, and that a single message from the people who produced it would close the
question. It is not a judgement on the work, and it is not a `defect`: that field means
something specific here and withholds the record.

If one of these is yours, see [Contributing](README.md#contributing): the error bar, the
variance, or the checkpoint all resolve it.

### Where an added error bar or variance came from: the `error_metrics` block

A row may carry a `sigma` or an `energy_variance` its paper does not print. The row's
`energy` is still the printed one; the `error_metrics` block says where the added numbers
came from:

```json
"error_metrics": {
  "fields": ["energy_variance"],
  "measured_by": "authors",
  "checked_on": "2026-09-16",
  "source": "authors' repository github.com/NeuralQXLab/convnextnnqs@c78787343c, data/optimizations.ipynb, ...",
  "source_file": "sources/2505.03466-repo-optimizations-j1j2.json",
  "reported_as": "(-0.4975827288198424, 5.751903088141703e-06) | (0.002727916908247034, 0)",
  "conversion": "v_score",
  "note": "..."
}
```

- `fields` names what the block set; nothing a row already carried is overwritten.
- `measured_by` is `authors` when the number is in the authors' own data release (a
  repository, a Zenodo record, a notebook's stored output, or the output files the authors
  sent for the entry, committed under `sources/` as received), and `qmbl` when we measured it
  on the checkpoint the authors published, with their network. A state we trained
  ourselves is never attached to someone else's row; it is a row of its own.
- `source_file` is committed under `sources/`, and every ` | `-separated part of
  `reported_as` appears in it verbatim, so each value can be checked from a clone.
- `conversion` is the convention the source states its variance in (`var_total_pauli`,
  `var_as_stored`, `var_total_SS`, `var_over_n_SS`, `var_over_n2_SS`, `v_score`), converted to the stored
  convention once, in [`scripts/add_error_metrics.mjs`](scripts/add_error_metrics.mjs).

A source's number is attached only if its energy agrees with the row's within two combined
error bars, which is the check that it describes the state behind the printed energy.
Passes are `error-metrics-YYYY-MM-DD.json` at the repository root.

## Provenance and defects

Rows cite **the primary paper that produced the number**. Where a number is quoted from
a different paper than the one that produced it, the row is marked `secondary` and names
both. arXiv preprint is the minimum bar; rows record whether the source is peer reviewed
and at what kind of venue, because a number refereed by a physics-numerics journal and
the same number refereed for machine-learning contribution are not equal evidence
([§8.1](RULES.md#81-venue-type)).

The validator in [`scripts/validate.mjs`](scripts/validate.mjs) runs on every build and
checks `dof` and `einf` against the instance definition, the V-score against the row's
own inputs, the row's energy against its own reported variance, and the variational
principle against any exact row in the same instance (combining the two error bars where
the exact row is stochastic QMC), and that every stochastic exact row states its sigma.

Rows that fail are **flagged in place, never silently corrected and never deleted** (a
duplicate, or a number that is not an energy of its instance, is removed under
[RULES.md §11](RULES.md#11-corrections)). The
flag withholds the record and nothing else; [§10](RULES.md#10-pending-confirmed-objections) is the process for lifting
or upholding it. A value the maintainers corrected is listed in `corrections` on the row,
each entry with the value it replaced (`from`), where the new one was read, and why;
`verified` records a check that found nothing wrong, and an independent re-read of a row
QMBL added itself is `verified.second_read`. An instance renamed because its upstream name
carries the wrong coupling has `relabelled` (the old id and the reason); the old id, where
rows were computed at that coupling, stays with `split` and an exact row QMBL computed
([`checks/hubbard-u-labels/`](checks/hubbard-u-labels/)). One worked case is in [`checks/`](checks/): three TFIsing `RBM (alpha = 1)` energies
sit up to 10 sigma below an exact solution; the program the rows link, rerun as pinned,
gives energies above it, and the stored numbers were uploaded in 2023 without code or log,
so the flag stays and the mechanism is recorded as unknown. A `defect` carries `flag`,
`finding` (the evidence, with the source of every claim), optionally `diagnosis`,
`ruled_out` and `evidence` (a shared block written for that row or group of rows, never
attached by flag name alone) and `source_entry` (the verification proposal it was
written from).
