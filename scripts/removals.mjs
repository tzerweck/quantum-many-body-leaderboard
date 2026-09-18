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
  // Declared exact, but above the exact energy (RULES.md 11).
  {
    match: { instance: "J1J2/square_36_P_0.7", method: "ED (this work)", energy: -76.318416 },
    ruled: "2026-09-18 (Tristan): not the exact energy, removed; the exact result stays",
    reason: "Table I of arXiv:2606.04558 prints -0.529989 per site, which is 1.223e-5 per site (24.5x the half-width of its 6 printed decimals) above the ground state -76.320176597454 carried on this instance. Transcribed correctly; the calculation, not the reading, is off. The ground state is reproduced independently by our symmetric-basis Lanczos on 99problems to 1e-13 (qmbl-runs/qmbl-verify-2026-09-17-j1j2-36) and printed as -0.530001 by Schulz, Ziman & Poilblanc, J. Phys. I 6, 675 (1996), Table II, 36(B1) - the paper's own reference for its ED. A scan of every spin-inversion-even sector of the 6x6 torus finds nothing lower.",
  },
  {
    match: { instance: "J1J2/square_36_P_0.8", method: "ED (this work)", energy: -84.45384 },
    ruled: "2026-09-18 (Tristan): not the exact energy, removed; the exact result stays",
    reason: "Table I of arXiv:2606.04558 prints -0.586485 per site, which is 1.600e-6 per site (3.2x the half-width of its 6 printed decimals) above the ground state -84.45407039473 carried on this instance. Transcribed correctly; the calculation, not the reading, is off. The ground state is reproduced independently by our symmetric-basis Lanczos on 99problems to 1e-13 (qmbl-runs/qmbl-verify-2026-09-17-j1j2-36) and printed as -0.586487 by Schulz, Ziman & Poilblanc, J. Phys. I 6, 675 (1996), Table II, 36(B1) - the paper's own reference for its ED. A scan of every spin-inversion-even sector of the 6x6 torus finds nothing lower.",
  },
  {
    match: { instance: "J1J2/square_36_P_0.9", method: "ED (this work)", energy: -93.462912 },
    ruled: "2026-09-18 (Tristan): not the exact energy, removed; the exact result stays",
    reason: "Table I of arXiv:2606.04558 prints -0.649048 per site, which is 4.011e-6 per site (8.0x the half-width of its 6 printed decimals) above the ground state -93.463489624054 carried on this instance. Transcribed correctly; the calculation, not the reading, is off. The ground state is reproduced independently by our symmetric-basis Lanczos on 99problems to 1e-13 (qmbl-runs/qmbl-verify-2026-09-17-j1j2-36) and printed as -0.649052 by Schulz, Ziman & Poilblanc, J. Phys. I 6, 675 (1996), Table II, 36(B1) - the paper's own reference for its ED. A scan of every spin-inversion-even sector of the 6x6 torus finds nothing lower.",
  },
  {
    match: { instance: "J1J2/square_36_P_1", method: "ED (this work)", energy: -102.867264 },
    ruled: "2026-09-18 (Tristan): not the exact energy, removed; the exact result stays",
    reason: "Table I of arXiv:2606.04558 prints -0.714356 per site, which is 4.433e-6 per site (8.9x the half-width of its 6 printed decimals) above the ground state -102.867902314985 carried on this instance. Transcribed correctly; the calculation, not the reading, is off. The ground state is reproduced independently by our symmetric-basis Lanczos on 99problems to 1e-13 (qmbl-runs/qmbl-verify-2026-09-17-j1j2-36) and printed as -0.714360 by Schulz, Ziman & Poilblanc, J. Phys. I 6, 675 (1996), Table II, 36(B1) - the paper's own reference for its ED. A scan of every spin-inversion-even sector of the 6x6 torus finds nothing lower.",
  },
  // Not an energy of the instance.
  ...["J1J2/triangular_108_P_0.125", "J1J2/triangular_144_P_0.125"].map(instance => ({
    match: { instance, method: "Thermodynamic-limit estimate interpolated to this size (1/L^3)" },
    ruled: "2026-09-17 (Tristan): not a finite-size result",
    reason: "Table III of Roth, Szabo & MacDonald, PRB 108, 054410 (2023) fills this size from the thermodynamic-limit estimate of Iqbal et al., PRB 93, 144411 (2016) and the exact 36-site energy, assuming 1/L^3 finite-size scaling. Nobody computed this cluster.",
  })),
];
