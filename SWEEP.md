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

## The backwards sweep (2026-09-14, evening) — 161 candidates becomes 7940

With paging, loud failure and `--since 2019` in place, the sweep was rerun through the
arxiv.org search fallback, the API having been 429 for over three hours by then.

**7940 unique candidates, 1927 peer reviewed**, against 161 before. Not a 49× improvement
in the literature — a measurement of how much of it the old harvester could not see. The
per-query audit in `sweep-queries.tsv` names the three queries that hit the page cap
(`vscore`, `minsr-opt`, `nqs-any`) rather than letting them read as complete; they want a
higher `--max-pages` on the next run.

The year distribution is the answer to "is the backlog worth mining":

| 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| 389 | 520 | 600 | 674 | 746 | 854 | 1131 | 3026 |

2019–2023 is 2929 candidates that no sweep has ever seen, against 4157 from 2025–26. And
the zero-coverage families finally have a pool to triage: Impurity 84, TFIsing 32,
shuriken 25, tV 23, pyrochlore 174, kagome 177.

PDFs were fetched and layout-extracted for the whole prior pool: **214 committed source
texts, up from 8**, which took the table harvest from 385 PDF cells to 2179.

**Impurity: nobody has published on these Hamiltonians (2026-09-15).** The 12 instances are
VarBench's own bath discretisations (`vendor/varbench/Impurity/HamParams`), so no other
paper's total energy is comparable. All 247 papers citing VarBench or the FTPS paper
(PRX 7, 031013) in Semantic Scholar and OpenAlex were screened, 215 in full text, for the
instance names and stored energies (`sweep-cites.tsv`): none uses them but VarBench itself.

### TFIsing had no coverage because it could not be matched, not because nobody published

The family showed 0 of 7 instances covered. Three independent defects made a match
arithmetically impossible, each sufficient alone.

**A factor of 4.** TFIsing sat in `SPIN_MODELS` and inherited the `4*N` divisor that
Heisenberg and J1-J2 need for the Pauli→S·S conversion. Its Hamiltonian
`-Σ sᶻsᶻ - h Σ sˣ` is already in Pauli operators with no S·S term to rescale, so per-site
is `E/N`. Under `4*N`, `chain_32_P_1` read −0.3184 where the literature quotes −1.2738 —
every cell missed by 4×.

Not a judgment call: the chain is exactly solvable, and `validate.mjs` now asserts it every
run. Summing `−2√(h² − 2h cos k + 1)` over `k = π(2n+1)/N` reproduces all three stored PBC
exact rows, `chain_32_P_1` to 7e-15, and `E/N = −1.27375` sits just below `−4/π = −1.27324`
as PBC at criticality must.

**272 TFIsing cells had no size token.** Finite-size tables name sizes in the leftmost
column and nowhere else. A bare integer alone in a row label is now read as a size. Chains
needed the converse: on a chain the linear size *is* the site count, and 1D papers write L,
not N — no chain instance in any family had an `L=` token before.

**Nothing checked boundary conditions**, though §2 makes them part of the instance. An
open-chain N=32 value matched the *periodic* `chain_32_P_1` on size alone, 0.92% away — a
gap that is entirely the boundary condition.

### arXiv:2605.13807 — a variational energy below its own exact column

The first TFIsing candidate the sweep ever produced is a defect, not a record.

Its exact column at N=10 is **−1.2381490**, reproducing `TFIsing/chain_10_O_1`'s stored
exact row to seven digits — instance, unit convention and open boundary confirmed in one
step, which is the convention check of §8 passing on a family that had never had one.

But its `1D LRU` variational energy at N = 10, 24 and 32 sits **below** its own exact
column, while sitting correctly above at N = 6, 8, 12, 16, 48, 64 and 96. At N=10 that is
−1.2381549 against −1.2381490, about 8σ on the paper's own error bar.

Suspicion fell on the harvester first, a column shift having just been fixed one commit
earlier. It is not: these cells came through the HTML path, which has real cell boundaries,
and an independent matrix-free Lanczos ED (`checks/tfim_obc_ed.mjs`) reproduces the paper's
exact column at N = 6…16 to seven decimals. The columns are right and the inversion is real.

**This is the second source reporting a sub-exact variational energy on this one 10-site
instance.** VarBench's own `RBM (alpha = 1)` row is 2.3e-5 below exact, already resolved in
`checks/` as an optimization-trace minimum rather than a converged measurement. Two
unrelated groups making the same class of error on the smallest instance on the board is a
pattern, and the cheapest argument QMBL has for requiring a variance next to an energy.

## The pipeline pass (2026-09-14, earlier) — the pool was never a census

Every number below the line was harvested by a pipeline that reported its own coverage
incorrectly. Four defects, each of which made the result look complete when it was not.

**The candidate pool was a floor.** `sweep_search.mjs` asked arXiv for `max_results=40`
with no paging, so all twelve queries were truncated at 40 hits regardless of how many
matched. "161 unique candidates since 2025" was twelve queries capped, not twelve queries
answered. It now pages until it reaches the date floor, and a page cap that binds is
reported as TRUNCATED with the hit count it abandoned.

**A network failure was indistinguishable from an empty result.** `get()` returned `""`
after its retries, so an HTTP 429 logged as `<tag>: 0 since 2025` — character for
character what a query matching nothing logged. Any sweep run during an arXiv outage
would have been recorded as a sweep that found nothing new. A failed request is now a
hard error, named in `sweep-queries.tsv`, printed in a banner, non-zero exit; and the
candidate file is merged rather than replaced, so a partial run can only ever add.

This is not hypothetical. `export.arxiv.org/api` returned 429 to every request for over
an hour on 2026-09-14 while `arxiv.org` served PDFs and HTML normally. The two are rate
limited separately, so `--via auto` now falls back to the arxiv.org search UI. The
queries stay defined once, in API syntax, and are parsed into groups: the search UI
applies operators left to right with no grouping, so `A AND (B OR C)` is expanded into
its cartesian product of flat AND queries and unioned rather than trusting its
precedence. 21 queries become 101 sub-queries.

**The date floor was hard-coded at 2025-01-01.** 54 of the first 97 accepted rows came
from pre-2025 papers, and arXiv has no HTML before ~Dec 2023, so the backlog had never
been *searched*, let alone read. `--since` now defaults to 2019.

**The table harvester only read HTML.** For the entire pre-2024 literature the only
machine-readable form is pypdf layout-mode text, so those tables were reachable only by
hand. `harvest_tables.mjs` now mines them too. It is a different parsing problem: there
are no cell boundaries, only character offsets; a dash is a minus before a digit and a
missing entry otherwise, where the HTML path flattens both; and layout mode strips the
spaces out of justified captions, so keyword tests run against the despaced form as well.

### The off-by-one that invented a record

Matching a value to its header by nearest position is wrong on its own, and wrong
*systematically*: headers are centred over columns whose values are right-aligned, so
every value sits left of its own header and lands on the previous one.

On arXiv:2206.14307 this filed the J2 = 0.4 energy under J2 = 0.7 and reported it as
beating `J1J2/square_100_P_0.7` by 0.96%. What exposed it was not the size of the claim
but an impossibility one row up: the same table's *exact diagonalization* column, read
the same way, came out **below** the instance's own exact row. No variational number can
sit under an exact one on the same instance, so the columns had shifted — the tell was
internal consistency, not plausibility.

A row carrying exactly as many energies as there are header cells settles the alignment
by order alone. Those rows now calibrate one offset per table, applied to the ragged rows
where a missing entry makes the counts disagree. Verified against the paper: the 10×10
RBM row reads J2 = 0.0, 0.2, 0.4, 0.6, 0.7 as printed, the 6×6 row 0.5, 0.55, 0.6.

**The rows added by hand from this paper earlier today are unaffected and were
re-verified against lines 299–304 and 442–444: −0.51889(2) really is the J2 = 0.7
column.** The human reading was right; only the automated assignment was wrong. That is
the argument for the method note in §8 rather than against it.

### Instance discipline: the coupling, and where it is stated

Within a family, instances differ *only* by a coupling — J1J2 by J2, tV by V, TFIsing by
the transverse field h — and nothing checked it. One 4×4 spinless-fermion energy came
back as a candidate for both `tV/square_16_P_5_0.01` and `tV/square_16_P_5_0.1`, two
different Hamiltonians, on size alone. Same failure mode as the t′ case in §2, and higher
volume, since J1J2 is the largest family on the board.

Where the coupling is stated decides what it is worth. A caption routinely enumerates
every value in the table ("J2 = 0.0, 0.2, 0.4, 0.6, 0.7"), so a check that reads captions
lets every column match every sibling. The column header is specific to the cell and
wins, then the row label; a coupling known only from the caption is marked as such.
Deliberately not matched: `alpha`. In an NQS paper that is the hidden-unit density, and
reading it as J2 would reject most of the largest family on the board.

### Shuriken — a thermodynamic-limit trap, caught before it became three records

The first paper the fixed sweep surfaced for a zero-coverage family was
**arXiv:2211.16932** (Schmoll, Kshetrimayum, Naumann, Eisert & Iqbal), a peer-reviewed
2022 tensor-network study of the spin-1/2 Heisenberg AFM on the Shuriken lattice. All
four shuriken instances hold exactly one row each, every one of them the frozen VarBench
import, so any second row would have been the first competition they have ever had.

It is **rejected**: iPEPS/iPESS on an *infinite* lattice, the same ground as 2510.04907
below. Its best energy, −0.440908 per site, sits within 1% of three of the four
instances — inside the matcher's BEATS window — and below all three:

| instance | record E/N | −0.440908 would be |
|---|---|---|
| `Heisenberg/shuriken_96_P` | −0.438260 | a false record, −0.604% |
| `Heisenberg/shuriken_216_P` | −0.437600 | a false record, −0.756% |
| `Heisenberg/shuriken_384_P` | −0.437129 | a false record, −0.865% |
| `Heisenberg/shuriken_24_P` | −0.448329 | above it, +1.655% |

Nothing about the *number* would have caught this, and the near-miss at N=24 is what the
pattern looks like from the inside: a thermodynamic-limit value tracks finite-size ones
closely enough to pass any plausibility check, and crosses them at some size. Only the
finite-versus-infinite rule in §2 rejects it.

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
