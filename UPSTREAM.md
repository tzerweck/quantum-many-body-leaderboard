# Issues in the upstream VarBench data

Found while maintaining QMBL, in the VarBench snapshot vendored at `vendor/varbench`
(commit `390a21ea`, 2024-10-22). Each was still present on VarBench `main` when checked.
Not reported upstream. QMBL never edits an imported row: the issue is attached to the row as
a `defect` in `scripts/defects.mjs` (RULES.md 11), and a flagged row cannot hold a record.

| instance (VarBench file) | row | issue | in QMBL |
|---|---|---|---|
| `Hubbard/square_36_PA_18_2` | HFDS (VMC Hidden Fermion Determinant State) | The 8x8 row copied into the 6x6 file: energy, sigma and variance (-76.162, 0.006, 0.14(2)) are those of `square_64_PA_32_2`, uploaded 67 minutes later (commits c810bdcd22, 21f00e54f6). As a 36-site energy it lies below the non-interacting ground state. The paper's 6x6 value is -1.2079(1) per site. Found 2026-09-15; verified against the PNAS supplement and AFQMC (Qin et al., PRB 94, 085103). | `wrong-instance`; paper value added as its own row |
| `Hubbard/square_64_PA_32_6` | HFDS | Stores E/N -0.666813; the paper gives -0.6574(2) in both the PNAS supplement (Table 5) and arXiv. The stored total is 25 sigma below the sign-free AFQMC total -42.17(2) for this lattice (Qin et al., Table IV). Found 2026-09-15. | `below-exact` |
| `Hubbard/square_36_PA_*` (all four) | HFDS | Method strings read "N_hidden = 16 ... alpha = 1", the 8x8 settings, while the PNAS supplement (Sec. 6) gives N_hidden = 8, alpha = 78 for 6x6. Probably copied with the file. | not flagged |
| `Heisenberg/square_196_P` | DMRG (bond dimension = 512) | `DOF` is 100 on a 196-site instance; the V-score derived from it is wrong. | `dof-mismatch` |
| `Heisenberg/triangular_144_P` | DMRG (bond dimension = 512) | `DOF` is 100 on a 144-site instance. | `dof-mismatch` |
| `TFIsing/chain_10_P_1`, `chain_10_O_1`, `chain_32_P_0.5` | RBM (alpha = 1) | 3.8 to 10.4 sigma below the exact free-fermion energy. A rerun shows they are minima of the optimisation trace, not converged energies (`checks/tfising_rbm_check.py`). | `below-exact`, `below-exact-suspected` |
| `Hubbard/square_16_P_5_2.1544` | DMRG (MaxBondDim 7000) | 1.7e-6 relative below exact diagonalisation. Not investigated. | not flagged |
| `Hubbard/square_16_P_4_3.5981`, `square_16_P_5_3.5981` | DMRG | 1.1e-4 and 2.1e-4 per site above ED with variances of 2e-6 and 3e-7: converged to an excited state. Valid upper bounds (the first holds its record), but the V-score says near-exact. Found 2026-09-15. | not flagged |
| `Hubbard/rectangular-4x8_32_P_14_8`, `-4x8_32_PO_14_8`, `-4x16_64_P_28_8`, `-4x16_64_PO_28_8` | HFDS, pinned to lambda = 8 stripe order | Not a data error. The variances were submitted by the HFDS author and are genuine, but the pinned states sit near competing stripe states, so their V-scores understate the energy error 10-70x (RULES.md 9). HFPS beats HFDS on 4x8 with 25x the variance. Found 2026-09-15. | not flagged |
