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

- **`variational`**: a strict variational upper bound on the ground-state energy in the
  stated sector. VMC, DMRG and MPS at finite bond dimension, PEPS, NQS, VQE and other
  parameterised circuits, and p-step Lanczos applied to a variational state.
- **`projected`**: variational only within a constraint, or otherwise biased. Fixed-node
  and constrained-path methods, GFMC on a trial state, constraint-release schemes.
  Still an upper bound in most cases, but node- or constraint-dependent, so two projected
  energies from different trial states are not cleanly comparable to each other or to
  variational ones.
- **`extrapolated`**: the reported number is an extrapolation, not an achieved energy:
  zero-variance, bond-dimension, or Trotter-error extrapolation. **Not a bound.** No
  ansatz ever reached it.
- **`exact`**: numerically exact for this instance: exact diagonalization, exact solution,
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

The record for an instance is the **lowest eligible `variational` energy**.
`projected`, `extrapolated` and `exact` rows are displayed alongside but never hold it.

- Rows whose error bars overlap at **2 sigma** share the rank.
- **A sampled energy must state its `sigma` to be eligible.** `sigma` must also state how it
  was estimated. An error bar that ignores autocorrelation understates by around an order of
  magnitude, which is enough to manufacture a record. Report the blocking or binning analysis,
  or the raw chain. A sampled row without `sigma` is listed and is eligible for nothing.
- **A deterministic energy needs no `sigma`.** DMRG at a stated bond dimension, exact
  diagonalization, statevector circuits and tensor-network contractions carry no statistical
  error, so there is no error bar to withhold; their convergence control is the bond dimension
  or truncation error carried in `method`. 144 of the 399 variational rows are of this kind.
  Requiring `sigma` of them would vacate more than half the table's records over a field that
  cannot exist. `scripts/units.mjs` draws the line by explicit deterministic markers, and
  anything not so marked counts as sampled.
- Case: the 4x4 J1-J2 VQE rows. `exact grads & metric, statevector` and `2^14 samples/grad`
  appear as separate rows on the same instance. The first is deterministic and eligible without
  a `sigma`; the second is sampled, reports none, and is not. On four instances the sampled
  variant sat lower and would have taken the record with no error bar to check it against.
- A row without `energy_variance` is completely fine. The V-score renders `n/a` and nothing is
  inferred or reconstructed. Most of the literature stops at the energy, and a missing V-score
  is never held against a row; it only means the row cannot be compared across instances.
- **A row with no error metric we could find is marked, not penalised.** Where neither a
  `sigma` nor an `energy_variance` turned up in the source that was read, there is currently no
  way to judge how converged the number is, and a reader comparing two energies should see that
  rather than infer it from two blank cells. The marker is `o` in `scripts/records.mjs` and a
  circle in the README table, derived at display time from the two absent fields.

  **The marker describes our search, not the authors.** The figure may be in a supplement, a
  companion paper, or the group's own records; what the row records is that we did not find it.
  It is therefore an open question addressed to whoever can close it - the row stays in the
  table and in rank order, and closing it takes one message. It is deliberately **not** a
  `defect` (11), which asserts a suspected error and withholds the record: missing data is not
  an error, and by 3 it excludes nothing. `exact` rows are not marked, since an exact
  diagonalization has no error to report and nothing is missing.

### 6.1 A flagged row cannot hold a record

A row carrying a `defect` is displayed in rank order, in place, with its flag - and is skipped
when the record is assigned. Suspicion is enough to withhold a record; it is never enough to
hide or delete a row (11). Section 10 is how a flag gets lifted or upheld.

This exists because the opposite happened on first implementation: **5 of 7 flagged rows held
their instance record**, including the three TFIsing `RBM (alpha = 1)` rows a rerun had already
shown to be minima of an optimization trace. Ranking purely on energy promotes precisely the
numbers that are wrong, because being wrong downward is what makes a number look like a record.

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

### 8.1 Venue type

"Peer reviewed" is not one thing. A number in *Phys. Rev. B* has been refereed by people who
check physics numerics; the same number in a machine-learning conference proceedings has been
refereed for machine-learning contribution. Both are peer reviewed; only one is evidence about
the energy. Rows therefore record the venue, and a physics-numerics venue outranks an ML venue
when the two disagree.

Case: arXiv:2607.00398 (conference proceedings) claims -0.49782(3) on 10x10 J1-J2, described in
its own abstract as "statistically consistent with the variational state of the art". It is 1.3e-4
below the best variational energy, i.e. an unclaimed record, and on 8x8 it beats the field by
1.1e-3 while reporting a variance 6x-14x worse - the tension in 9.3. Both rows are listed
and flagged `energy-variance-inconsistent`. Note what is *not* claimed: there is no exact
reference at either size, so nothing here is proof of error, only grounds for objection.

### 8.2 `baseline`: collected versus computed

VarBench did two different things, and the imported rows must say which. A row whose
reference cites a **paper** is one VarBench *collected* from the literature. A row whose
only reference is a run script in `varbench/methods` is one VarBench *computed itself*,
and carries `baseline: true`. Of the 578 imported rows, **369 are computed and 209
collected**.

The distinction matters because the two are different kinds of claim. A collected row is
somebody's published result, defended in a paper. A computed row is a **reference
calculation** - the same ansatz run across the instance set so the V-score would have
something to measure against. `Jastrow baseline` is named as one. Nobody ever claimed
state of the art for a plain `RBM (alpha = 1)`; it is the floor, not a contender.

The evidence that these are reference runs rather than results is in what they report.
Rows VarBench computed carry `energy_variance` **76%** of the time and `sigma` 46%; rows
citing a paper carry variance **35%** and sigma **90%**. That inversion is the V-score's
fingerprint: the metric needs Var(E), almost no paper publishes it, so the benchmark had
to produce it. The same ansatz then recurs across dozens of instances - exact
diagonalization on 74, `RBM (alpha = 1)` on 44, `Jastrow baseline` on 44.

A baseline row is a full citizen of the table: it ranks, it can hold a record, and it is
cited to the VarBench paper. The flag changes nothing about eligibility. It exists so
that "record held by `RBM (alpha = 1)`" reads as *nobody has published a better number
for this instance*, rather than as a defended claim - because those are the instances
worth attacking, and one of those readings finds them and the other does not.

## 9. Validation

`scripts/validate.mjs` runs on every change and checks:

1. `dof` and `einf` against the instance definition (§5).
2. The V-score recomputed from the row's own energy, variance, dof and einf.
3. **Energy against the row's own variance.** Where a row reports both, the V-score must be
   consistent with the energy: a state further from an eigenstate cannot also be lower in
   energy. This is the check that works where **no exact reference exists at all** - ED for
   frustrated 2D models reaches roughly 6x6, so 8x8 and 10x10 J1-J2 have no exact row and
   never will. Being lower than an *extrapolated* ground state proves nothing on its own,
   since the extrapolation may carry systematic error; being lower than the field while
   reporting a worse variance is grounds for objection.

   **It is not proof, because the inference only runs one way.** A small variance means
   close to *an* eigenstate, not to the ground state. A state pinned near a competing,
   excited configuration has little variance and a large energy error, and a better state
   below it will then report the worse variance. Case (2026-09-15): VarBench's HFDS rows on
   the four 4xL Hubbard instances at 1/8 doping are each pinned to lambda = 8 stripe order,
   among near-degenerate stripe states. Their variance per unit energy error is 0.18-1.6,
   against 6-80 for every other Hubbard row with an exact or DMRG reference - including on
   the open-boundary instances, where extrapolated DMRG is an independent check. HFPS sits
   0.47% below HFDS on 4x8 with 25x its variance, and is the better state. Two VarBench DMRG
   rows on 4x4 (U = 3.5981, 8 and 10 electrons) show the same signature from having
   converged to an excited state. The check stands; what it establishes is a question to
   the authors, which is how the HQT case in 8.1 is carried.
4. **The variational principle**: no `variational` row may sit below an `exact` row in the
   same instance. Sector-resolved ED rows are excluded, since an unconstrained state may
   legitimately sit below the lowest state of one sector. A violation counts only past
   3 sigma, or past a relative 1e-8 when no sigma is given.

Six issues survive these checks on the imported VarBench data. They are carried as known
defects attached to the row (§11), not silently corrected.

**Resolved case, 2026-09-11: the three TFIsing `RBM (alpha = 1)` rows.** They sit 3.8 to
10.4 sigma below an exact solution, which no variational state can be. Rerun on three seeds
each (netket 3.22.4, alpha=1 complex RBM, 2000 SR steps): evaluating the trained parameters
by **full summation over all 1024 basis states**, with zero Monte-Carlo error, puts every
converged energy *above* the exact value as the variational principle requires, while every
training trace dips 1.5e-3 to 3.5e-3 *below* it. Each published value lies between the two.
The conclusion is that the published number is **a minimum of the optimization trace, not a
converged measurement**. An underestimated error bar is ruled out: tau_corr <= 0.05 and
R_hat = 1.0000 across all six runs. Evidence in `checks/`.

This is why §6 requires a stated sigma *and* how it was estimated, and why §10 admits
"violates the variational principle against a known exact reference" as grounds for
objection. A leaderboard that ranked on energy alone, with no exact-reference check, would
have carried all three as records.

**The case none of the above would catch: kagome, 108 sites (2026-09-14).** Ðurić et al.,
*Phys. Rev. X* 15, 011047 (2025), report a spinon pair-density-wave ground state at
E₀ = −48.18 on a 108-site cluster, 1.78% below the DMRG benchmark of −47.33964 they compare
against. A Comment (arXiv:2605.28861) shows the single-spin-flip update used at that size
does not conserve total magnetisation. As the network concentrates on the physical
S<sup>z</sup><sub>tot</sub> = 0 sector the acceptance rate collapses to *exactly zero* beyond
5000 iterations, so the chains freeze and the average is taken over a non-representative set
of configurations. Under the magnetisation-preserving exchange update the same architecture
converges to ≈ −45.6, and re-evaluating the spin-flip-optimised *parameters* ergodically gives
≈ −42.6; the published number lies below all of them.

Three things make this the sharpest case in this document:

1. **No check on the number itself could have caught it.** DMRG at finite bond dimension is
   an upper bound too, so an energy below it is not evidence of error; ordinarily it is just
   a better state. There is no exact reference at 108 sites. The refutation had to come from
   the *sampler*, which is why §10 now admits non-ergodic sampling as its own ground.
2. **The instance ends with no record at all.** Its only `variational` row is flagged, and the
   DMRG row is `extrapolated`: Depenbrock et al. state their energies are "extrapolated in
   the truncation error of single-site DMRG", which lies below any energy an MPS achieved.
   "No eligible record" is the correct answer here, and a table ranking on energy alone would
   instead have printed a refuted number as the record.
3. **DMRG is not one `bound_type`.** At a *stated bond dimension* it is a strict variational
   bound; *extrapolated in the truncation error* it is not. The same method name maps to two
   different classes depending on one sentence in the methods section.

## 10. Pending, confirmed, objections

Anyone may object by opening an issue against the row. An objection must be specific and
technical. A new row is **`pending`** for 30 days and **`confirmed`** if no objection is unresolved. Admissible grounds:

- wrong symmetry sector, particle number, or boundary conditions;
- wrong unit convention (§5);
- `bound_type` misdeclared (§4);
- `sigma` estimated without autocorrelation correction (§6);
- the energy violates the variational principle against a known exact reference (§9);
- **the sampling is non-ergodic**: the Monte Carlo update rule is incompatible with a
  conservation law or symmetry of the Hamiltonian, so the reported average is taken over a
  non-representative set of configurations (§9, the kagome case);
- the number cannot be located in the cited source (§8).

The submitter may correct or withdraw. A confirmed row is overturned only by an objection
that meets the same bar. Rulings cite a clause.

## 11. Corrections

Errors found by the maintainers are corrected in public with the reason recorded on the row.
Rows are never silently deleted; superseded ones are marked and kept.
