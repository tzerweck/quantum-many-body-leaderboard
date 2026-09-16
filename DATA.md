# QMBL data

What the files in `data/` contain and how to read them. The leaderboard is in
[README.md](README.md); the rules that decide a record are in [RULES.md](RULES.md).

## What is in the data

`data/<Model>/<instance>.json`, one file per instance, plus `data/_summary.json`.

This is the row currently holding the 10×10 J1-J2 record, in full:

```json
{
  "model": "J1J2", "lattice": "square", "n_sites": 100, "boundary": "P",
  "params": { "J2": 0.5 },
  "instance_id": "J1J2/square_100_P_0.5",
  "rows": [
    {
      "energy": -199.07756, "sigma": 0.00008, "energy_variance": null,
      "dof": 100, "einf": 0, "v_score": null,
      "method": "CNN-MPS (h,D,l)=(32,20,20), Marshall sign transformation",
      "bound_type": "variational",
      "bound_type_reason": "variational ansatz; energy is a strict upper bound",
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
      }
    }
  ]
}
```

`baseline: true` marks a row VarBench **computed itself** rather than collected from a
paper: a reference calculation run across the instance set so the V-score would have
something to measure against, not a published state-of-the-art claim. 369 of the 578
imported rows are of this kind. 75 of VarBench's own exact diagonalizations hold their
instance's record, as any exact energy does ([§6](RULES.md#6-records-and-ties)), and 27
of its variational reference runs do, which means *no published result has ever beaten the
benchmark's own reference run on those instances*
(`baseline_records` in `data/_summary.json` counts the latter). See
[§8.2](RULES.md#82-baseline-collected-versus-computed).

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

Blocks are attached by `scripts/add_compute.mjs` from `compute-rows-<date>.json`, one file
per reading pass, applied in date order; the first (2026-09-16) read all 130 papers behind
the non-baseline rows in full, appendices and supplements included, and found a statement
in 81 of them.

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
  derived; the stored fields stay as reported.

A missing `compute` block excludes nothing, exactly like a missing variance.

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
  repository, a Zenodo record, a notebook's stored output), and `qmbl` when we measured it
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
principle against any exact or unbiased row in the same instance (combining the two error bars
where the reference is an unbiased QMC energy), and that every unbiased row states its sigma.

Rows that fail are **flagged in place, never silently corrected and never deleted**. The
flag withholds the record and nothing else; [§10](RULES.md#10-pending-confirmed-objections) is the process for lifting
or upholding it. One worked case is resolved in [`checks/`](checks/): three TFIsing
`RBM (alpha = 1)` energies sit up to 10 sigma below an exact solution, and a rerun with
full summation over all 1024 basis states shows the published values are minima of the
optimization trace rather than converged measurements.
