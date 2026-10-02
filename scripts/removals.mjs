// Rows removed from the table, each with the ruling and its reason (RULES.md §11). The
// scripts that add these rows still read them from their sources; apply_removals.mjs takes
// them out after every row is in, so a removal is one line here and never a silent edit of
// an import script.
export const REMOVALS = [
  // Duplicates: the same number carried twice. The row read from the original paper stays.
  {
    match: { instance: "Hubbard/square_256_PA_128_8", method: "AFQMC", energy: -134.25 },
    ruled: "2026-09-17 (Tristan): duplicate, the original paper's row stays",
    reason: "VarBench's copy of -134.25(3) from Qin, Shi & Zhang, PRB 94, 085103 (2016), Table IV, which add_exact_rows.mjs reads from the paper itself. The copy carried no bound_type.",
  },
  {
    match: { instance: "Heisenberg/square_100_O", method: "PEPS (bond dimension = 10)", energy: -251.4404 },
    ruled: "2026-09-17 (Tristan): duplicate, the original paper's row stays",
    reason: "VarBench's copy of the finite-PEPS energy of Liu, Dong, Han, Guo & He, PRB 95, 195154 (2017), which add_sweep2_rows.mjs carries with its error bar and that paper as the reference.",
  },
  {
    match: { instance: "Heisenberg/square_256_O", method: "PixelCNN (deep autoregressive)", energy: -658.890752 },
    ruled: "2026-09-17 (Tristan): duplicate, the original paper's row stays",
    reason: "The energy of Sharir, Levine, Wies, Carleo & Shashua, PRL 124, 020503 (2020) as quoted in a later paper's table; the row read from that paper itself (NAQS) stays.",
  },
  {
    match: { instance: "J1J2/square_100_P_0.5", method: "VMC (p = 2)", energy: -199.0196 },
    ruled: "2026-09-17 (Tristan): duplicate, the original paper's row stays",
    reason: "The two-Lanczos-step energy of Hu, Becca, Parola & Sorella, PRB 88, 060402 (2013), as Table I of arXiv:2310.05715 quotes it (-0.4975490(2) per site); the row read from Table III of arXiv:1304.2630 itself (-0.49755(1) per site) stays.",
  },
  {
    match: { instance: "Hubbard/square_64_PA_32_6", method: "VMC Hidden Fermion Determinant State Ansatz (N_hidden = 16. Single hidden layer fully connected net with alpha = 1). Soft mean-field constraint for Neel order.", energy: -42.676 },
    ruled: "2026-10-02 (Tristan): duplicate, the original paper's row stays (apply step of the 2026-09-29 verification pass, the duplicates rule of 2026-09-17)",
    reason: "The first author's VarBench upload (c810bdc, 2022-07-16) of the 8 x 8, U = 6 HFDS state of Robledo Moreno et al., PNAS 119, e2122059119, with a digit slip (-42.076 -> -42.676): the paper prints -0.6574(2) per site (SI Table 5, row L = 8, column U = 6), which add_worklist_rows.mjs carries from the paper itself as -42.0736, sigma 0.0128. A corrected copy would duplicate that row (qmbl-verify 2026-09-29, VA3-10-1073-pnas-2122059119#34, skeptic upheld). Its below-exact flag goes with it; the upload-only sigma 0.007 and variance 0.82(1) have no printed counterpart.",
  },
  {
    match: { instance: "Heisenberg/pyrochlore-2x2x2_128_P", method: "mVMC (PP + RBM + 1st step Lanczos, spin-parity projection, Number of RBM neurons: 128)", energy: -252.007 },
    ruled: "2026-10-02 (Tristan): duplicate, the original paper's row stays (apply step of the 2026-09-29 verification pass, the duplicates rule of 2026-09-17)",
    reason: "First author R. Pohle's VarBench upload of 2022-02-26 (380a1fe), 21 months before arXiv:2311.11561 v1, energy never updated; the paper prints the same spin-parity mVMC-RBM/Lanczos state as -0.49229(7) per site (SM Table SI, column psi+ (random), and App. B), which the table carries from the paper itself (-252.05248). The stored -252.007 is printed nowhere. The 2026-09-16 ruling to supersede the VarBench row was not applied until now (qmbl-verify 2026-09-29, VA5-hubbard-heisenberg-tfising-j1j2#21, skeptic upheld).",
  },
  {
    match: { instance: "Heisenberg/pyrochlore-3x3x3_432_P", method: "mVMC (PP + 1st step Lanczos, spin-parity projection, C3 point-group projection)", energy: -844.084 },
    ruled: "2026-10-02 (Tristan): duplicate, the original paper's row stays (apply step of the 2026-09-29 verification pass, the duplicates rule of 2026-09-17)",
    reason: "First author R. Pohle's VarBench upload of 2022-02-26 (7afd2cc), 21 months before arXiv:2311.11561 v1, never updated; the paper prints the same spin-parity mVMC/Lanczos state as -0.48851(3) per site (SM Table SII), which the table carries from the paper itself (-844.14528). The stored -844.084 is printed nowhere, and the linked VarBench input (RBM with 432 neurons, no C3 projection, no Lanczos step) cannot have produced it. The 2026-09-16 ruling to supersede the VarBench row was not applied until now (qmbl-verify 2026-09-29, VA5-hubbard-heisenberg-tfising-j1j2#22, skeptic upheld).",
  },
  // Declared exact, but above the exact energy (RULES.md 11).
  {
    match: { instance: "J1J2/square_36_P_0.4", method: "ED (this work)", energy: -76.283136 },
    ruled: "2026-09-18 (Tristan): not the exact energy, removed; the exact result stays",
    reason: "Table I of arXiv:2606.04558 prints -0.529744 per site. The ground state -76.283280827996 carried on this instance is -0.529745006 per site, which prints as -0.529745 whether rounded or truncated, so the printed number is not the exact energy at its own precision: it sits 1.006e-6 per site above it, from the same run as the four rows below (every value in that column lies above the exact energy, as a Lanczos stopped short does). The ground state is reproduced independently by our symmetric-basis Lanczos on an AMD EPYC 9654 server to 1e-13 (qmbl-runs/qmbl-verify-2026-09-17-j1j2-36) and printed as -0.529745 by Schulz, Ziman & Poilblanc, J. Phys. I 6, 675 (1996), Table II, 36(A1).",
  },
  {
    match: { instance: "J1J2/square_36_P_0.7", method: "ED (this work)", energy: -76.318416 },
    ruled: "2026-09-18 (Tristan): not the exact energy, removed; the exact result stays",
    reason: "Table I of arXiv:2606.04558 prints -0.529989 per site, which is 1.223e-5 per site (24.5x the half-width of its 6 printed decimals) above the ground state -76.320176597454 carried on this instance. Transcribed correctly; the calculation, not the reading, is off. The ground state is reproduced independently by our symmetric-basis Lanczos on an AMD EPYC 9654 server to 1e-13 (qmbl-runs/qmbl-verify-2026-09-17-j1j2-36) and printed as -0.530001 by Schulz, Ziman & Poilblanc, J. Phys. I 6, 675 (1996), Table II, 36(B1) - the paper's own reference for its ED. A scan of every spin-inversion-even sector of the 6x6 torus finds nothing lower.",
  },
  {
    match: { instance: "J1J2/square_36_P_0.8", method: "ED (this work)", energy: -84.45384 },
    ruled: "2026-09-18 (Tristan): not the exact energy, removed; the exact result stays",
    reason: "Table I of arXiv:2606.04558 prints -0.586485 per site, which is 1.600e-6 per site (3.2x the half-width of its 6 printed decimals) above the ground state -84.45407039473 carried on this instance. Transcribed correctly; the calculation, not the reading, is off. The ground state is reproduced independently by our symmetric-basis Lanczos on an AMD EPYC 9654 server to 1e-13 (qmbl-runs/qmbl-verify-2026-09-17-j1j2-36) and printed as -0.586487 by Schulz, Ziman & Poilblanc, J. Phys. I 6, 675 (1996), Table II, 36(B1) - the paper's own reference for its ED. A scan of every spin-inversion-even sector of the 6x6 torus finds nothing lower.",
  },
  {
    match: { instance: "J1J2/square_36_P_0.9", method: "ED (this work)", energy: -93.462912 },
    ruled: "2026-09-18 (Tristan): not the exact energy, removed; the exact result stays",
    reason: "Table I of arXiv:2606.04558 prints -0.649048 per site, which is 4.011e-6 per site (8.0x the half-width of its 6 printed decimals) above the ground state -93.463489624054 carried on this instance. Transcribed correctly; the calculation, not the reading, is off. The ground state is reproduced independently by our symmetric-basis Lanczos on an AMD EPYC 9654 server to 1e-13 (qmbl-runs/qmbl-verify-2026-09-17-j1j2-36) and printed as -0.649052 by Schulz, Ziman & Poilblanc, J. Phys. I 6, 675 (1996), Table II, 36(B1) - the paper's own reference for its ED. A scan of every spin-inversion-even sector of the 6x6 torus finds nothing lower.",
  },
  {
    match: { instance: "J1J2/square_36_P_1", method: "ED (this work)", energy: -102.867264 },
    ruled: "2026-09-18 (Tristan): not the exact energy, removed; the exact result stays",
    reason: "Table I of arXiv:2606.04558 prints -0.714356 per site, which is 4.433e-6 per site (8.9x the half-width of its 6 printed decimals) above the ground state -102.867902314985 carried on this instance. Transcribed correctly; the calculation, not the reading, is off. The ground state is reproduced independently by our symmetric-basis Lanczos on an AMD EPYC 9654 server to 1e-13 (qmbl-runs/qmbl-verify-2026-09-17-j1j2-36) and printed as -0.714360 by Schulz, Ziman & Poilblanc, J. Phys. I 6, 675 (1996), Table II, 36(B1) - the paper's own reference for its ED. A scan of every spin-inversion-even sector of the 6x6 torus finds nothing lower.",
  },
  {
    match: { instance: "Heisenberg/pyrochlore-2x2x2_32_P", method: "Exact diagonalization", energy: -66.1514 },
    ruled: "2026-09-29 (Tristan): not the exact energy, removed; the exact result stays",
    reason: "The paper's own ED, stored by VarBench as -0.5168078 per site (first-author upload ef22cb4): PRX 11, 041021 plots it at j2/j1 = 0 in Fig. 2(a) and truncates it to -0.5168 in Table II (qmbl-verify 2026-09-29, VJ2-journal-other#9). Two diagonalizations of the same 32-site cluster (VarBench's StdFace geometry) on an AMD EPYC 9654 server give the ground state -66.15792523719963, over the whole S^z = 0 space and in the fully symmetric sector of the space group, agreeing to 1.2e-11 (checks/pyrochlore-32-ed/). The stored value sits 6.5e-3 above it, 65x the 1e-4 it is printed to, so it is not the ground-state energy at its own precision. The recomputed energy is carried on this instance (add_exact_rows.mjs, batch B2).",
  },
  // Declared exact, but a per-site rounding times N that lies below the ground state: QMBL's
  // recomputed row replaces it (ruling 2026-09-30, the pyrochlore-32 mechanism). Its U = 4
  // sibling, -13.62192 = -0.85137 x 16 on Hubbard/square_16_P_8_4, needs no entry here: that
  // per-site quote is QMBL's -13.6218548212 rounded to its printed digits, so
  // add_allresults_rows.mjs skips it as the exact row already carried (see batch B2).
  {
    match: { instance: "Hubbard/square_16_P_8_8", method: "ED", energy: -8.46896 },
    ruled: "2026-09-30 (Tristan): QMBL's recomputed row stands, the quoted row is removed",
    reason: "The ED energy of Anderson et al., Comput. Theor. Chem. 1003, 22 (2013), which prints -8.46888 (arXiv:1207.4847 Table IV, U/t = 8), stored as the per-site -0.52931 that arXiv:2602.03031 quotes (ref. [35]) times 16 = -8.46896. Two diagonalizations of the 4x4 torus at half filling on an AMD EPYC 9654 server give -8.4688750142 (checks/hubbard-4x4-half-filling-ed/): the stored value sits 8.5e-5 below the ground state (the per-site quote is one unit off in its last digit), while the producer's -8.46888 is the ground state correctly rounded. The recomputed energy is carried on this instance (add_exact_rows.mjs, batch B2).",
  },
  // Not an energy of the instance.
  ...["J1J2/triangular_108_P_0.125", "J1J2/triangular_144_P_0.125"].map(instance => ({
    match: { instance, method: "Thermodynamic-limit estimate interpolated to this size (1/L^3)" },
    ruled: "2026-09-17 (Tristan): not a finite-size result",
    reason: "Table III of Roth, Szabo & MacDonald, PRB 108, 054410 (2023) fills this size from the thermodynamic-limit estimate of Iqbal et al., PRB 93, 144411 (2016) and the exact 36-site energy, assuming 1/L^3 finite-size scaling. Nobody computed this cluster.",
  })),
];
