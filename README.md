# QMBL — the Quantum Many-Body Leaderboard

Ground-state track. Imports the [VarBench](https://github.com/varbench/varbench)
dataset (Apache-2.0, frozen 2024-10-22) into a structured, CI-validatable form and
adds the `bound_type` field VarBench lacks.

    node scripts/emit.mjs          # data/<Model>/<instance>.json + data/_summary.json
    node scripts/classify_report.mjs   # bound_type coverage
    node scripts/audit.mjs [class]     # distinct method strings per class

`bound_type` is one of `exact` | `variational` | `projected` | `extrapolated` | `null`
(null = needs human review; never guessed). Rule order in `scripts/bound_type.mjs`
is load-bearing — "exact grad" in a VQE method string describes the gradient, not
the energy, so variational circuits are matched before the exact rule.

Units follow VarBench: spin Hamiltonians in Pauli (sigma.sigma) convention, so
`E/N` in the S.S convention used by NQS papers is `energy / (4 * n_sites)`.
Hubbard energies are totals, not per site.

## Citing

Releases are archived on Zenodo with a versioned DOI, so a paper can cite a frozen
comparison set (`.zenodo.json`, `CITATION.cff`). Setup, once, by hand:
enable the repo at zenodo.org/account/settings/github, then push a tagged release —
Zenodo archives that snapshot and mints the DOI. Add the concept-DOI badge here after
the first release.
