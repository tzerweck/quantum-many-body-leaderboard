# QMBL rules

Version 0.1 (draft, 2026-09-11). These rules exist so that accepting or rejecting a
row is a matter of citing a clause, not of anyone's judgment about anyone's work.
Where a rule was written in response to a concrete case, the case is named.

## 1. Scope

Track 1, the only track open, covers **ground-state energies of lattice Hamiltonians**
computed by any method. A row is a claim about one (Hamiltonian instance, method) pair.

Out of scope for now: real-time dynamics, finite temperature, continuum and molecular
systems. Each needs an accuracy metric that track 1's does not provide, and no track
opens until track 1 is maintained.

## 2. Instances

An instance is a fully specified Hamiltonian: model, lattice, site count, boundary
conditions, and every coupling. Rows are comparable only within an instance.

Instance identity is part of the claim. A submitter asserting a record must state the
symmetry sector and particle number; if a paper's number turns out to be from a
different sector, the row moves rather than competes.

## 3. Required fields

| field | required | notes |
|---|---|---|
| `energy` | yes | in the instance's stored convention (§5) |
| `sigma` | for a ranked row | the error bar on the mean, with §6 |
| `bound_type` | yes | one of §4; never guessed |
| `method` | yes | enough to identify the ansatz and any projection |
| `reference` | yes | §8 |
| `dof`, `einf` | yes | checked against the instance (§9) |
| `energy_variance` | no | renders `n/a`; enables the V-score |
| compute | no, requested | GPU-hours x device, parameter count, samples, wall-clock |

A missing field never excludes a row. Only §6 and §7 govern what can hold a record.

## 4. `bound_type`

Every row declares exactly one. **This is the field that keeps the table honest**, because
energies from different classes are not comparable and mixing them manufactures false records.

- **`variational`** — a strict variational upper bound on the ground-state energy in the
  stated sector. VMC, DMRG and MPS at finite bond dimension, PEPS, NQS, VQE and other
  parameterised circuits, and p-step Lanczos applied to a variational state.
- **`projected`** — variational only within a constraint, or otherwise biased. Fixed-node
  and constrained-path methods, GFMC on a trial state, constraint-release schemes.
  Still an upper bound in most cases, but node- or constraint-dependent, so two projected
  energies from different trial states are not cleanly comparable to each other or to
  variational ones.
- **`extrapolated`** — the reported number is an extrapolation, not an achieved energy:
  zero-variance, bond-dimension, or Trotter-error extrapolation. **Not a bound.** No
  ansatz ever reached it.
- **`exact`** — numerically exact for this instance: exact diagonalization, exact solution,
  sign-problem-free QMC where that is established.

Worked cases that fixed the boundaries:

- *"exact grad" is not an exact energy.* 21 rows read `VQE + symm. circuit (64 pars.,
  exact grad, statevector)`. That describes how the gradient was computed. They are
  `variational`. Rule order in `scripts/bound_type.mjs` is load-bearing for this reason.
- *p-step Lanczos stays variational.* A Lanczos step applied to a variational state is a
  variational improvement, not a projection.
- *Zero-variance extrapolation is its own class.* Chen & Heyl report both a variational
  −0.4976921(4) and an extrapolated −0.497715(9) on 10x10 J1-J2. Ranking them in one
  column would award the record to a number no wave function achieved.
- *A method name is not a guarantee.* `QMC (continuous-time expansion)` is numerically
  exact for impurity models, but on t-V lattice instances its rows sit above exact
  diagonalization and 4.7e-2 above DMRG. It is `null` pending per-model classification.
- *When in doubt, `null`.* Bare `QMC` and `AFQMC` strings are unresolved: sign-problem-free
  (exact) and constrained-path (projected) are different classes and the string does not say.

## 5. Units and conventions

Stored conventions follow VarBench and are asserted per instance, not per row:

- Spin models are written with **Pauli matrices** and stored as **totals**. Papers quote
  `E/N` in the `S.S` convention: `E/N = energy / (4 * n_sites)`.
- Hubbard and t-V are stored as **totals**; papers quote **per site**.
- `dof` is the spin count for spin models, `N_up + N_dn` for Hubbard, and the particle
  count for **spinless** t-V.
- `einf` is `0` for traceless spin Hamiltonians, `U * N_up * N_dn / n_sites` for the plain
  Hubbard model. Hopping terms are traceless, so a `t'` variant keeps the same `einf`;
  extra density-density terms do not.

Any submitted number is converted by the loader, never by hand.

## 6. Records and ties

The record for an instance is the **lowest `variational` energy with a stated `sigma`**.
`projected`, `extrapolated` and `exact` rows are displayed alongside but never hold it.

- Rows whose error bars overlap at **2 sigma** share the rank.
- `sigma` must state how it was estimated. An error bar that ignores autocorrelation
  understates by around an order of magnitude, which is enough to manufacture a record.
  Report the blocking or binning analysis, or the raw chain.
- A row without `sigma` is listed and is eligible for nothing.

## 7. Aggregate

The headline is **records held**: the number of instances where a group holds the record.
There is no cross-instance score. The V-score is shown where `energy_variance` is present
and is never ranked on.

## 8. Provenance

- **arXiv preprint minimum.** Rows flag whether the source is peer reviewed.
- Preprint-only sources older than 12 months are flagged `stale-preprint`.
- A row whose number is quoted from a *different* paper than the one that produced it is
  marked `secondary` and names both.
- **A cited number that cannot be found in the cited source is not admissible.** Case:
  arXiv 2604.25775 reports "the previous best result −0.766073(6) from NNBF [24]", citing
  Loehr & Clark arXiv 2510.26906. That value appears nowhere in the only public version of
  that paper, whose best 4x16 energy is −0.76560(1); its lower −0.768337(2) is a 4x8 number.
  The −0.76560(1) row is admissible, the −0.766073(6) row is not.

## 9. Validation

`scripts/validate.mjs` runs on every change and checks:

1. `dof` and `einf` against the instance definition (§5).
2. The V-score recomputed from the row's own energy, variance, dof and einf.
3. **The variational principle**: no `variational` row may sit below an `exact` row in the
   same instance. Sector-resolved ED rows are excluded, since an unconstrained state may
   legitimately sit below the lowest state of one sector. A violation counts only past
   3 sigma, or past a relative 1e-8 when no sigma is given.

Six issues currently survive these checks on the imported VarBench data and are carried as
known upstream defects rather than silently corrected. Three are RBM rows sitting up to
6.8 sigma below an exact solution on TFIsing chains.

## 10. Pending, confirmed, objections

A new row is **`pending`** for 30 days and **`confirmed`** if no objection is unresolved.
Anyone may object by opening an issue against the row. An objection must be specific and
technical. Admissible grounds:

- wrong symmetry sector, particle number, or boundary conditions;
- wrong unit convention (§5);
- `bound_type` misdeclared (§4);
- `sigma` estimated without autocorrelation correction (§6);
- the energy violates the variational principle against a known exact reference (§9);
- the number cannot be located in the cited source (§8).

Not admissible: that a method is uninteresting, that a comparison is unflattering, or that
a competing row ought to have been cited.

The submitter may correct or withdraw. A confirmed row is overturned only by an objection
that meets the same bar. Rulings cite a clause.

## 11. Corrections

Errors found by the maintainers are corrected in public with the reason recorded on the row.
Rows are never silently deleted; superseded ones are marked and kept.
