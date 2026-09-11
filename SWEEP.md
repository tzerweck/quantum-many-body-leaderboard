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
