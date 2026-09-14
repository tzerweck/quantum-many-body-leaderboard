# Literature sweep — refresh targets

Method (fixed, see RULES.md §8): take content from **arXiv HTML parsed locally**, never from an
LLM summary of a table — that was caught mangling columns and inventing electron counts on
2026-09-10. Then check for a **peer-reviewed version** (Nature/Science/PRX/PRL/PRB/PRResearch/
Nat. Phys./Nat. Commun. all count) and record `journal_ref` + `doi`. Preprint-only rows are
flagged and rank weaker. Where arXiv and journal versions disagree on a number, the journal
version wins and the discrepancy is recorded.

Second pass on every paper: **harvest its bibliography**. Comparison tables cite the results
they are beating, and reviews aggregate SOTA across models we have not touched. That is how the
triangular/kagome/pyrochlore instances get found — nobody wrote a SOTA note for them.

## The table pass (2026-09-14) — mine the comparison table, not the claim

The 09-13 sweep read claim *sentences* ("state of the art", "we reach"). That only finds papers
that brag in prose about one headline number, which is why it produced four J1-J2 rows and
nothing at all for the frustrated magnets: those papers print a table of sizes and never write
the sentence. `scripts/harvest_tables.mjs` now pulls every energy cell out of every data table
in the cached sources (134 tables, 2611 cells) and `scripts/match_tables.mjs` maps them onto
instances, ranking by position against the current record.

**The highest-yield source is the table a paper prints of *other people's* numbers.** Several
rows found this way are 2019–2023 results that had been beating a VarBench record since before
VarBench froze. The dataset's problem is not only that it stopped; it is that it never mined
the benchmark tables in the first place.

Two ar5iv details cost most of the recall on the first attempt, and any future scraper needs
both: energies are glued together with **zero-width characters**, which `\s` does not match,
and a paper's **own results are rendered in mathematical bold digits** (U+1D7CE and up), which
are not `[0-9]`. Fixing those two took the harvest from 2182 cells to 2611 and surfaced the
triangular and square-Heisenberg candidates the first pass missed entirely.

Instance discipline lives in the matcher, not in review: Hubbard filling and t′ must agree, or
arXiv:2604.25775's t′=−0.2 column reads as a 0.4% "record" against the t′=0 16×16 instance.

### Accepted — 30 rows, 6 records, 1 new instance

| instance | row | source | via |
|---|---|---|---|
| `Heisenberg/triangular_36_P` | **−0.560313(3)** Group CNN — **new record**, was DMRG χ=2048 | arXiv:2211.07749 (2023) | 2505.20406 Tab. 5 |
| `Heisenberg/triangular_36_P` | −0.5601(4) LCN; −0.55922 GCNN; −0.5562(2) RNN | 2206.07370, 2104.05085, 2505.20406 | 2505.20406 Tab. 5 |
| `Heisenberg/square_36_P` | **−0.67887(2)** 2D RNN — **new record** | arXiv:2502.17144 | own Tab. 5 |
| `Heisenberg/square_100_P` | **−0.67155260(3)** CNN+MinSR — **new record** | Chen & Heyl, Nat. Phys. 20, 1476 (2024) | 2502.17144 Tab. 5 |
| `Heisenberg/square_100_O` | **−0.628656(9)** 2D TRNN — **new record**; plus first exact row | arXiv:2207.14314; QMC arXiv:2601.20189 | 2605.13807 Tab. 2 |
| `Heisenberg/square_256_O` | **new instance** (16×16 OBC), 4 rows incl. exact QMC | arXiv:2605.13807 | own Tab. 2 |
| `Hubbard/square_64_P_28_8` | **−0.7458(6)** JBf 8×8 torus — **new record**, +5 rows, all with Var(E) | *PRB* 113, 245104, arXiv:2510.11710 | own Tab. 1 |
| `Hubbard/rectangular-4x8_32_PO_14_8` | −0.73342(8) HFDS, −0.7332(6) JBf, both with Var(E) | arXiv:2510.11710 | own Tab. 1 |

The `2510.11710` rows matter out of proportion to their count: it reports six ansätze on one
instance under identical conditions **with σ²/M for each**, so they arrive V-score-computable.
Their V-scores order exactly with their energies (8.9e-3 at the record, 2.9e-2 at the worst),
which is §9.3's internal-consistency check passing across a whole instance at once.

### Pyrochlore — checked, records confirmed current (a result in itself)

`arXiv:2604.11880` Table 9 is a careful literature comparison for the pyrochlore Heisenberg AFM
that separates finite-size from thermodynamic values and variational from extrapolated ones.
Two entries touch QMBL instances and **neither is a new row**:

- `mVMC, Astrakhantsev et al., 4×4³, N=256, −0.4831(1)` is the same result as our existing
  record −0.4830957 on `pyrochlore-4x4x4_256_P`, quoted to fewer digits. The stalest instance
  in the table (V-score 1.1e-1) is stale because **nobody has beaten it**, not because we
  stopped looking.
- `mVMC-RBM/Lanczos, Pohle et al., L=2, N_s=128, −0.49229(7)` is a re-quote of the same Pohle
  result that gives `pyrochlore-2x2x2_128_P` its record of −0.4922012. Importing the rounded
  third-party value as a new record would have manufactured one out of a rounding difference.

Everything else in that table is a thermodynamic-limit or extrapolated estimate.

## The PDF pass (2026-09-14) — the papers no sweep could see

`scripts/fetch_pdfs.mjs` downloads an arXiv PDF and extracts its text with pypdf into
`sources/<id>.txt`, which **is committed** (the PDF itself stays ignored) so a row's number
remains checkable from a clone. This exists because of a blind spot in every sweep so far:
**arXiv has no HTML for papers before roughly Dec 2023**, so the entire pre-2024 literature —
which is where most *primary* sources live — was invisible to the harvester.

### arXiv:2206.14307 (2022) — the J2 ≠ 0.5 column, filled

A Lanczos-recursion paper carrying a full J2 sweep at 6×6 and 10×10. **Eight new records**:
`square_36_P` at J2 = 0.4, 0.6, 0.8, 1.0 and `square_100_P` at J2 = 0.4, 0.7, 0.8, 1.0.

This corrects the provisional read recorded below. The J2 ≠ 0.5 instances were not stale
because the 2025-26 field concentrated on the maximally frustrated point — they were **never
populated from the literature that already existed in 2022**. One of them was still held by a
plain α=1 RBM while a published p-step Lanczos result sat 8.5e-3 lower.

Convention was verified before a single row was written, and this is the pattern to reuse:
the paper prints its own **exact-diagonalization column** at 6×6, which agrees with the exact
rows already on those instances at J2 = 0.4, 0.7, 0.8 and 1.0 to six significant digits (max
deviation 4.3e-7). That fixes the unit convention, the meaning of the J2 label and the cluster
geometry in one step. Every 6×6 value added then sits above its instance's exact row.

### Five rows upgraded from `secondary` to `primary`

The pre-2024 primaries behind rows added in the table pass were fetched and all five values
located in the paper that produced them, with the quoted passage now on the row:
arXiv:2211.07749, 2206.07370, 2104.05085 (triangular 36) and 2206.14307 (square 36 and 100).
This matters most for `triangular_36_P`, whose record no longer rests on a quote of a quote.

### Kagome — RESOLVED 2026-09-14: the instance is open, with no record

`arXiv:2605.28861` (Kamal, Kufel, Vu, Laumann & Yao) is a Comment on Ðurić et al.,
*Phys. Rev. X* 15, 011047 (2025), which reported a G-CNN energy **1.78% below the best DMRG
benchmark** on a 108-site kagome cluster and claimed a spinon pair-density-wave ground state.
The Comment shows the single-spin-flip update rule used at N=108 does not conserve total
magnetisation, so the Markov chains freeze — acceptance collapses to exactly zero beyond 5000
iterations — and with ergodic exchange updates the same ansatz converges **≈3.5% above** DMRG.
Re-evaluating the spin-flip-optimised parameters under ergodic sampling raises the energy from
≈−46.2 to ≈−42.6 against a DMRG value of ≈−47.3.

The Comment itself only quotes figure-read approximations, so the precise numbers were taken
from the two primary sources instead, both fetched as PDF: **arXiv:2401.02866** (the PRX paper)
gives `E0 = -48.18(0)` against the DMRG benchmark `-47.33964` it compares to, and
**arXiv:1205.4858** (Depenbrock, McCulloch & Schollwöck, *PRL* 109, 067201) gives that DMRG
value in its own Table I as the 108-site torus, `-0.4383(3)`.

`Heisenberg/kagome-6x6_108_P` is now open, with both rows and the defect flag. **It ends with no
eligible record**, and that is the right answer: its only `variational` row is flagged, and the
DMRG row is `extrapolated` because Depenbrock et al. state their energies are "extrapolated in
the truncation error of single-site DMRG". Worked case now in RULES.md §9, new objection ground
in §10.

The 48-site cluster is a separate story and **gains a legitimate new record**: -0.4304323 →
-0.4375 (Ðurić GCNN). The Comment does not reach it — Ðurić et al. use the ergodic exchange
update below 108 sites — and the instance's existing exact row -0.4387039 equals that paper's
own ED value -21.057787063/48 to eight digits, which confirms cluster and convention.

### Still blocked

- **Kagome.** RESOLVED — instance open, dispute recorded, 48-site record taken (see above).
  `2510.04907`'s kagome values stay rejected (iPEPS, ξ→∞). Open: the precise DMRG benchmark at
  N=48, where the Comment reports ~0.09% relative error but quotes no number.
- **Triangular above L=6.** `2505.20406` reports L=6…30 finite-size energies in *figures*;
  Tab. 2 carries only their V-scores and Tab. 6 only thermodynamic-limit values. Its −0.5497
  (OBC) and −0.5517569(9) (PBC) are **E∞/N, not finite-size** — the earlier note below reads as
  if they were rows, and importing them would have been a false record at every triangular size.
- **Square J1-J2 at J2 ≠ 0.5.** RESOLVED by the PDF pass above — 8 new records. The provisional
  read below was wrong about the cause, and is kept only to show how it failed.

## Harvest (2026-09-12)

`scripts/sweep_search.mjs` -> **161 unique candidates since 2025, 39 peer reviewed**
(`sweep-candidates.tsv`, scored by whether the abstract promises a usable energy).
`scripts/harvest_refs.mjs` mines seed bibliographies -> `sweep-refs.tsv` (56 distinct cited
arXiv ids from 7 seeds, 49 not already in the candidate list).

Peer-reviewed, highest scoring, not yet mined:

| arXiv | journal | why |
|---|---|---|
| 2510.11710 | Phys. Rev. B 113, 245104 | *comparison* of symmetrized determinant NQS - comparison papers carry benchmark tables |
| 2506.08329 | Phys. Rev. B 113, 085134 | neuralized fermionic tensor networks |
| 2510.04907 | Phys. Rev. B 113, 045117 | PEPS on the triangular lattice |
| 2502.13454 | Phys. Rev. Lett. 134 | Hubbard with finite fermionic PEPS |
| 2512.14414 | Phys. Rev. B 113, 155127 | single-layer variational tensor network states |

Preprint-only but high value: 2604.21978 (intertwined orders in the Hubbard model),
2608.12465 (t-t' Hubbard), 2605.28861 (the kagome Comment).

**Confirmed from the harvest:** neither 2510.26906 (NNBF) nor 2604.25775 (ACE) has a journal
version, so the -0.766073(6) provenance problem in RULES.md 8 cannot be resolved by checking a
published version - there is none.

Two leads found only through the citation graph, neither in the keyword search:

- **2503.10462** Chen, Naik & Heyl, *Convolutional transformer wave functions* - 10x10 square
  J1-J2, E/N = **-0.4976764**. Above their own ResNet -0.4976921, so not a record, but a row.
- **2502.17144** Moss et al. - RNN wavefunctions to 30x30. No J1-J2 energies in the text; numbers
  are likely in figures. Needs a closer look.

## Status 2026-09-11

Only **4 of 177** instances have any post-2024 row (`scripts/staleness.mjs`).

### Triangular — best lead

- **arXiv 2505.20406**, "Leveraging recurrence in neural network wavefunctions for large-scale
  simulations" — RNN wavefunctions on the triangular-lattice AFM Heisenberg model, with both OBC
  and PBC results and an explicit **"Appendix J: Comparison of results to benchmarks and other
  methods"**. VarBench's triangular records are *2D Gated RNN*, so this is thedirect successor.
  Carries e.g. -0.5497 (OBC) and -0.5517569(9) (PBC). **Sizes and convention must be matched
  before any row is written** — VarBench stores Pauli totals, this paper quotes S.S per site.
  Preprint as of the search; check for a journal version.
- arXiv 2510.04907, *Phys. Rev. B 113, 045117 (2026)* — PEPS on the triangular lattice. Peer reviewed.
- arXiv 2602.14892, *Phys. Rev. Lett. 137, 056703* — competing states, S=1/2 triangular J1-J2.
- arXiv 2606.31021, 2607.14766 — triangular J1-J2 (preprints).

### Kagome

- **arXiv 2605.28861** — a *Comment on* "Spin-1/2 Kagome Heisenberg Antiferromagnet: Machine
  Learning Discovers...". A Comment disputes a published result, so it is high-value for exactly
  the kind of defect QMBL exists to record. Downloaded.
- arXiv 2602.12998 / 2507.20308 — variational study of kagome magnetization plateaus.
- arXiv 2512.16131, *Quantum Frontiers 4, 22 (2025)* — review; mine its references.

### Pyrochlore

- arXiv 2509.13746 — competing valence bond crystal orders in the pyrochlore ground state.
- arXiv 2601.07800 — rigorous Anderson-type **lower** bounds. Not a variational upper bound, so it
  is not a record, but it bounds the instance from below and is worth carrying.

### Square J1-J2 at J2 != 0.5 — likely genuinely stale, not merely unchecked

Checked 2505.03466 (PRResearch 7, 043099 (2025)), 2606.02794 (scaling laws) and now
2503.10462 (convolutional transformer): **all three report J2 = 0.5 and nothing else.** The 28 J1-J2 square papers since 2025 are phase-diagram, dynamics, magnon and
classical-MC studies, not variational-energy papers. Provisional read: the 2025-26 NQS literature
concentrated on the maximally frustrated point, leaving `square_100_P_0.4/0.7/0.8/0.9/1.0` at
their 2024 values — one of which is still a plain alpha=1 RBM. Worth confirming before claiming it.

## Leads examined and REJECTED (2026-09-13)

Recorded because a rejected lead is a result: without instance discipline each of these
would have produced a false record.

- **2510.04907** (*Phys. Rev. B* 113, 045117) — triangular −0.55136 and kagome −0.43929.
  Both are **iPEPS on an infinite lattice**, and the kagome value is an explicit
  `ξ→∞` extrapolation. QMBL instances are finite lattices, so neither maps onto
  `kagome-8x8_192_P` or any triangular instance. Dropping them into a finite instance
  would have manufactured records out of thermodynamic-limit numbers. Admitting these
  needs a thermodynamic-limit instance class, which is a scope decision, not an import.
- **2604.21978** — 8×8 Hubbard PBC, U=8, 1/8 doping, but at **t′ = −0.2**. Our
  `square_64_P_28_8` is t′ = 0, a different Hamiltonian. Needs a new instance; the
  VarBench naming convention for t′ variants (`_t12`) is not yet decoded, so this is
  parked rather than guessed.

## Accepted this pass

| instance | row | source | peer reviewed |
|---|---|---|---|
| `J1J2/square_100_P_0.5` | **−0.4976939(2)** CNN-MPS — **new record** | arXiv:2603.14425 | no |
| `J1J2/square_256_P_0.5` | **−0.4969140(5)** CNN-MPS — **new record** | arXiv:2603.14425 | no |
| `J1J2/square_400_P_0.5` | **−0.4967987(6)** CNN-MPS — **new instance** (20×20) | arXiv:2603.14425 | no |
| `Hubbard/rectangular-4x16_64_P_28_8` | −0.76413 HFPS | arXiv:2507.10705 | no |

Still to mine: 2502.14091 (*PRL* 136, Shastry-Sutherland, check finite vs iPEPS first),
2502.13454 (*PRL* 134, Hubbard + PEPS), 2506.08329 (*PRB* 113), 2605.13807, 2502.17144.
